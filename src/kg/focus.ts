import { baseId } from './collapse'
import { connections, type Connections } from './connections'
import { NO_STUDY, type KgGraph, type KgNode } from './types'

/**
 * What the user picked, the same in every view: a node, or a concept × study pair
 * ("what does this study have on this concept?" — a band in the flow view). The study
 * can be NO_STUDY, the "No study provided" placeholder.
 */
export type KgFocus = { node: string } | { concept: string; study: string }

export const isPair = (f: KgFocus): f is { concept: string; study: string } => 'concept' in f

export const sameFocus = (a: KgFocus | null, b: KgFocus | null) =>
  JSON.stringify(a) === JSON.stringify(b)

/** The variables whose study isn't provided: the ones under the NO_STUDY placeholder. */
export function studylessVariables(graph: KgGraph): Set<string> {
  const studies = new Set(graph.nodes.filter((n) => n.type === 'study').map((n) => n.id))
  const inStudy = new Set(graph.edges.filter((e) => studies.has(e.target)).map((e) => e.source))
  return new Set(graph.nodes.filter((n) => n.type === 'variable' && !inStudy.has(n.id)).map((n) => n.id))
}

/** The variables of `study` (or of none: NO_STUDY) that are on `concept`, in graph order. */
export function pairVariables(graph: KgGraph, concept: string, study: string): KgNode[] {
  const on = (target: string) => new Set(graph.edges.filter((e) => e.target === target).map((e) => e.source))
  const [onConcept, inStudy] = [on(concept), study === NO_STUDY ? studylessVariables(graph) : on(study)]
  return graph.nodes.filter((n) => n.type === 'variable' && onConcept.has(n.id) && inStudy.has(n.id))
}

/**
 * What to light up for a focus: a node's connections (see connections), or for a
 * pair the concept, the study and the variables between them, with their edges.
 * NO_STUDY stands in for the missing study: it lights up with its variables, and
 * focused, it lights up them and their concepts. Edge ids are "source->target", like
 * toElements. Empty if it isn't in the graph.
 */
export function focusConnections(graph: KgGraph, focus: KgFocus): Connections {
  const loose = studylessVariables(graph)
  if (!isPair(focus)) {
    if (focus.node === NO_STUDY) return placeholderConnections(graph, loose)
    const c = connections(graph, focus.node)
    if ([...c.nodes].some((id) => loose.has(id))) c.nodes.add(NO_STUDY)
    return c
  }
  const nodes = new Set<string>()
  const edges = new Set<string>()
  const variables = pairVariables(graph, focus.concept, focus.study)
  if (!variables.length) return { nodes, edges }
  nodes.add(focus.concept).add(focus.study)
  for (const v of variables) {
    nodes.add(v.id)
    edges.add(`${v.id}->${focus.concept}`)
    if (focus.study !== NO_STUDY) edges.add(`${v.id}->${focus.study}`)
  }
  return { nodes, edges }
}

/**
 * A focus picked on one drawing of a graph, carried over to another: after Group,
 * Shared only or Variables redraws it. A node still drawn stays focused; one merged
 * (versions, synonyms) moves to the node it was merged into; a merged node split
 * apart moves to its first release or member, whose id and label it was drawn with.
 * Null when it's gone (e.g. hidden by Shared only), or a pair has no variables left.
 */
export function carryFocus(focus: KgFocus | null, graph: KgGraph): KgFocus | null {
  if (!focus) return null
  if (!isPair(focus)) {
    const node = carryNode(graph, focus.node)
    return node ? { node } : null
  }
  const [concept, study] = [carryNode(graph, focus.concept), carryNode(graph, focus.study)]
  return concept && study && pairVariables(graph, concept, study).length ? { concept, study } : null
}

function carryNode(graph: KgGraph, id: string): string | null {
  if (id === NO_STUDY) return studylessVariables(graph).size ? NO_STUDY : null
  const n =
    graph.nodes.find((n) => n.id === id) ??
    graph.nodes.find((n) => n.versions?.includes(id) || n.grouped?.some((m) => m.id === id)) ??
    graph.nodes.find((n) => baseId(n.id) === id)
  return n?.id ?? null
}

// the placeholder, its variables, and the concepts they're on
function placeholderConnections(graph: KgGraph, loose: Set<string>): Connections {
  const nodes = new Set<string>()
  const edges = new Set<string>()
  if (!loose.size) return { nodes, edges }
  nodes.add(NO_STUDY)
  for (const id of loose) nodes.add(id)
  for (const e of graph.edges) {
    if (!loose.has(e.source)) continue
    nodes.add(e.target)
    edges.add(`${e.source}->${e.target}`)
  }
  return { nodes, edges }
}
