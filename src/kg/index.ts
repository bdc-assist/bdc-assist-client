// The public API: what a host imports (from this folder, never its files). model/ is the
// graph as data (plain TypeScript, no DOM); views/ draws it. See README.md. Everything
// else is internal: exported from its own file for the views and tests, not for hosts.

// the data: the API's `kg`, and the graph it's made into
export {
  fromKgList,
  kgParts,
  type KgPart,
  type KgWireEdge,
  type KgWireEntry,
  type KgWireNode,
} from './model/wire'
export {
  isConceptOrTerm,
  NO_STUDY,
  NO_STUDY_LABEL,
  NO_STUDY_NODE,
  type KgEdge,
  type KgGraph,
  type KgNode,
  type KgNodeType,
} from './model/types'

// the views
export type { KgView, KgViewOptions } from './views/view'
export { mountGraph, type GraphOptions, type GraphView } from './views/graph'
export { mountFlow, type FlowOptions, type FlowView } from './views/flow'
export { KG_CSS } from './views/marks' // their colours as CSS, for your legend or list

// which views suit a graph
export { KG_VIEWS, viewChoices, type KgLayout, type KgViewChoices, type KgViewName } from './views/view'

// what's picked, the same in every view
export {
  focusConnections,
  isPair,
  pairVariables,
  sameFocus,
  type Connections,
  type KgFocus,
} from './model/focus'
export { edgeId } from './model/types' // the ids of focusConnections' edges

// for your own UI: give these drawnGraph's graph, so ids match what the views draw
export { drawnGraph, type DrawOptions } from './model/drawn'
export { studyList, type ListConceptGroup, type ListStudy, type ListVariable } from './model/list'
export { nodeLinks, NO_VARIABLE_ACCESSION, type KgLink } from './model/links'
export { bridges } from './model/bridges'
export { bundles, type Bundle } from './model/bundle'
