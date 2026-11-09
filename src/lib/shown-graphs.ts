import type { DrawOptions, KgGraph, KgViewName } from '@/kg'

/** How a graph panel is showing an answer's graph: which graph (all calls merged, or one
 * call's), which view, with which options and Force positions. So an email of the answer can
 * draw it the same way (email-choices.tsx). */
export type ShownGraph = {
  graph: KgGraph
  view: KgViewName
  options: DrawOptions & { variables: boolean }
  forcePositions: Map<string, { x: number; y: number }>
}

// by the answer's graph: the graph part's object, which the panel gets as its `graph`
const shown = new WeakMap<KgGraph, ShownGraph>()

export const setShownGraph = (answerGraph: KgGraph, how: ShownGraph) => void shown.set(answerGraph, how)

/** How `answerGraph` is shown; undefined if its panel hasn't been drawn. */
export const shownGraph = (answerGraph: KgGraph) => shown.get(answerGraph)
