import { sharedOnly } from './bridges'
import { collapseVersions } from './collapse'
import { groupSynonyms } from './group'
import type { KgGraph } from './types'

/** How a graph is drawn: what's merged, and what's left out. Every view takes these. */
export type DrawOptions = {
  /** Merge the releases of a study or variable into one node (default true). */
  collapseVersions?: boolean
  /** Merge concepts with exactly the same neighbours, e.g. a search's synonyms (see
   * groupSynonyms; default true). */
  groupSynonyms?: boolean
  /** Show only what two or more seeds share (see bridges/sharedOnly; default false). */
  sharedOnly?: boolean
}

export const DRAW_DEFAULTS = { collapseVersions: true, groupSynonyms: true, sharedOnly: false } as const satisfies DrawOptions

/** The options that change what's drawn (a redraw), as opposed to how. */
export const DRAW_OPTIONS = Object.keys(DRAW_DEFAULTS) as (keyof DrawOptions)[]

/**
 * The graph as the views draw it with `options`: releases merged, then synonyms, then
 * reduced to what the seeds share (after merging: it can create bridges). Use it for
 * anything shown next to a view (a list, details), so ids match what's drawn.
 */
export function drawnGraph(graph: KgGraph, options: DrawOptions = {}): KgGraph {
  const o = { ...DRAW_DEFAULTS, ...options }
  let g = o.collapseVersions ? collapseVersions(graph) : graph
  if (o.groupSynonyms) g = groupSynonyms(g)
  return o.sharedOnly ? sharedOnly(g) : g
}
