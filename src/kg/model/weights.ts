import type { KgGraph } from './types'

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
