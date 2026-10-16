import { relations } from './query'
import type { KgGraph } from './types'

/** What a graph contains, whichever tool made it. */
export type KgShape = {
  seeds: number // nodes a call asked about
  variables: boolean
  studies: boolean // real ones: the "No study provided" placeholder isn't in a graph
  interConceptLinks: boolean // concept → concept edges, with Dug's predicates
}

export function shapeOf(graph: KgGraph): KgShape {
  const has = (type: string) => graph.nodes.some((n) => n.type === type)
  return {
    seeds: graph.nodes.filter((n) => n.seed).length,
    variables: has('variable'),
    studies: has('study'),
    interConceptLinks: relations(graph).length > 0,
  }
}
