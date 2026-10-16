import { edgeId, isConceptOrTerm, type KgEdge, type KgGraph, type KgNode, type KgNodeType } from './types'

/** A graph's lookups, worked out once: what the model's functions keep asking. */
export type Lookup = {
  byId: Map<string, KgNode>
  type: Map<string, KgNodeType>
  seeds: Set<string>
  /** A node's edges' targets, in edge order. */
  targets: Map<string, string[]>
  /** Both ways: each neighbour, with the edge's id (edgeId), in edge order. */
  around: Map<string, { other: string; edge: string }[]>
  /** A variable's study (its edge to a study). */
  studyOf: Map<string, string>
  /** A variable's concepts and terms, in edge order. */
  conceptsOf: Map<string, string[]>
}

// Graphs are never changed once made (every function here returns a new one), so their
// lookups can be kept for as long as the graph is
const cache = new WeakMap<KgGraph, Lookup>()

const add = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const list = m.get(k)
  if (list) list.push(v)
  else m.set(k, [v])
}

/** The graph's lookups (see Lookup), cached: a graph must not be changed after this. */
export function lookup(graph: KgGraph): Lookup {
  const seen = cache.get(graph)
  if (seen) return seen
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const type = new Map(graph.nodes.map((n) => [n.id, n.type]))
  const l: Lookup = {
    byId,
    type,
    seeds: new Set(graph.nodes.filter((n) => n.seed).map((n) => n.id)),
    targets: new Map(),
    around: new Map(),
    studyOf: new Map(),
    conceptsOf: new Map(),
  }
  for (const e of graph.edges) {
    const edge = edgeId(e.source, e.target)
    add(l.targets, e.source, e.target)
    add(l.around, e.source, { other: e.target, edge })
    add(l.around, e.target, { other: e.source, edge })
    const t = type.get(e.target)
    if (t === 'study') l.studyOf.set(e.source, e.target)
    if (isConceptOrTerm(t)) add(l.conceptsOf, e.source, e.target)
  }
  cache.set(graph, l)
  return l
}

/** The concept → concept edges: relationships between concepts (e.g. from
 * get_concept_connections), as opposed to variables' links. */
export function relations(graph: KgGraph): KgEdge[] {
  const { type } = lookup(graph)
  return graph.edges.filter((e) => type.get(e.source) === 'concept' && type.get(e.target) === 'concept')
}

/** Each variable's related_concepts_count scaled to 0..1 within the graph: 1 for the
 * highest, 0 for the lowest; 1 when its count is missing or all counts are equal. */
export function variableWeights(graph: KgGraph): Map<string, number> {
  const counts = graph.nodes.flatMap((n) =>
    n.type === 'variable' && n.related_concepts_count !== undefined ? [n.related_concepts_count] : [],
  )
  const [lo, hi] = [Math.min(...counts), Math.max(...counts)]
  return new Map(
    graph.nodes
      .filter((n) => n.type === 'variable')
      .map((n) => {
        const c = n.related_concepts_count
        return [n.id, c === undefined || !(hi > lo) ? 1 : (c - lo) / (hi - lo)]
      }),
  )
}
