import { relations } from './elements'
import type { KgLayout } from './mount'
import type { KgGraph } from './types'

/** Every view of a graph: mountGraph's layouts, the flow (mountFlow) and the list
 * (studyList), in the order a picker lists them: the default (Force) first. */
export const KG_VIEWS = ['force', 'radial', 'columns', 'flow', 'list'] as const
export type KgViewName = KgLayout | 'flow' | 'list'

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

/** The views a graph's shape allows: `true`, or why not (for a tooltip). */
export type KgViewChoice = { available: Record<KgViewName, true | string>; default: KgViewName }

/**
 * Which views suit `graph` (see shapeOf): Radial needs a seed to centre on, Columns
 * variables, Flow studies; Force and List always work. The default is Force, for
 * every shape. Work it out before "Shared only", so the filter never changes which
 * views are offered.
 */
export function graphShape(graph: KgGraph): KgViewChoice {
  const shape = shapeOf(graph)
  return {
    available: {
      radial: shape.seeds > 0 || 'Needs a concept that was asked about',
      force: true,
      columns: shape.variables || 'Needs variables',
      flow: shape.studies || 'Needs studies',
      list: true,
    },
    default: 'force',
  }
}
