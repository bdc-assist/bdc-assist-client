import type { KgGraph } from './types'

/** The concept → concept edges: relationships between concepts (e.g. from
 * get_concept_connections), as opposed to variables' links. */
export function relations(graph: KgGraph): KgGraph['edges'] {
  const types = new Map(graph.nodes.map((n) => [n.id, n.type]))
  return graph.edges.filter((e) => types.get(e.source) === 'concept' && types.get(e.target) === 'concept')
}
