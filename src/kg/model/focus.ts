import { baseId } from './collapse'
import { lookup } from './query'
import { edgeId, NO_STUDY, type KgGraph, type KgNode } from './types'

export type Connections = { nodes: Set<string>; edges: Set<string> } // edges by edgeId

/**
 * What a node is connected to, for highlighting: its direct neighbours, and one
 * step further through variables only. A concept links to everything, so going
 * on through concepts or studies would light up the whole graph; going through
 * variables gives the useful picture:
 * - a study: its variables, and the concepts they're on
 * - a concept: its variables, and their studies
 * - a variable: its concept(s) and its study
 * Includes the node itself; empty for an id not in the graph.
 */
export function connections(graph: KgGraph, id: string): Connections {
  const { type, around } = lookup(graph)
  const nodes = new Set<string>()
  const edges = new Set<string>()
  if (!type.has(id)) return { nodes, edges }
  nodes.add(id)
  for (const { other, edge } of around.get(id) ?? []) {
    nodes.add(other)
    edges.add(edge)
    if (type.get(id) === 'variable' || type.get(other) !== 'variable') continue
    for (const next of around.get(other) ?? []) {
      nodes.add(next.other)
      edges.add(next.edge)
    }
  }
  return { nodes, edges }
}

/**
 * What the user picked, the same in every view: a node, or a concept × study pair
 * ("what does this study have on this concept?" — a band in the flow view). The study
 * can be NO_STUDY, the "No study provided" placeholder.
 */
export type KgFocus = { node: string } | { concept: string; study: string }

export const isPair = (f: KgFocus): f is { concept: string; study: string } => 'concept' in f

export const sameFocus = (a: KgFocus | null, b: KgFocus | null): boolean => {
  if (!a || !b) return a === b
  if (isPair(a)) return isPair(b) && a.concept === b.concept && a.study === b.study
  return !isPair(b) && a.node === b.node
}

/** The variables whose study isn't provided: the ones under the NO_STUDY placeholder. */
export function studylessVariables(graph: KgGraph): Set<string> {
  const { studyOf } = lookup(graph)
  return new Set(graph.nodes.filter((n) => n.type === 'variable' && !studyOf.has(n.id)).map((n) => n.id))
}

/** The variables of `study` (or of none: NO_STUDY) that are on `concept`, in graph order. */
export function pairVariables(graph: KgGraph, concept: string, study: string): KgNode[] {
  const { targets, studyOf } = lookup(graph)
  const on = (id: string, target: string) => targets.get(id)?.includes(target) ?? false
  const inStudy = (id: string) => (study === NO_STUDY ? !studyOf.has(id) : on(id, study))
  return graph.nodes.filter((n) => n.type === 'variable' && on(n.id, concept) && inStudy(n.id))
}

/**
 * What to light up for a focus: a node's connections (see connections), or for a
 * pair the concept, the study and the variables between them, with their edges.
 * NO_STUDY stands in for the missing study: it lights up with its variables, and
 * focused, it lights up them and their concepts. Edges by edgeId, as toElements gives
 * them. Empty if it isn't in the graph.
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
    edges.add(edgeId(v.id, focus.concept))
    if (focus.study !== NO_STUDY) edges.add(edgeId(v.id, focus.study))
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
    lookup(graph).byId.get(id) ??
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
    edges.add(edgeId(e.source, e.target))
  }
  return { nodes, edges }
}
