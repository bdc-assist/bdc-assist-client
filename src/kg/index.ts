// The public API: what a host imports (from this folder, never its files). model/ is the
// graph as data (plain TypeScript, no DOM); views/ draws it. See README.md.

// the graph, and the API's `kg` it's made from
export {
  edgeId,
  isConceptOrTerm,
  NO_STUDY,
  NO_STUDY_LABEL,
  type KgEdge,
  type KgGraph,
  type KgNode,
  type KgNodeType,
} from './model/types'
export {
  fromKgList,
  kgLabel,
  kgParts,
  type KgPart,
  type KgWireEdge,
  type KgWireEntry,
  type KgWireNode,
} from './model/wire'

// reshaping it, as the views do
export { baseId, collapseVersions } from './model/collapse'
export { groupSynonyms } from './model/group'
export { bridges, sharedOnly } from './model/bridges'

// what's in it
export { bundles, type Bundle } from './model/bundle'
export { connections, type Connections } from './model/connections'
export { relations } from './model/relations'
export { variableWeights } from './model/weights'
export {
  graphShape,
  KG_LAYOUTS,
  KG_VIEWS,
  shapeOf,
  type KgLayout,
  type KgShape,
  type KgViewChoice,
  type KgViewName,
} from './model/shape'

// what's picked
export {
  carryFocus,
  focusConnections,
  isPair,
  pairVariables,
  sameFocus,
  studylessVariables,
  type KgFocus,
} from './model/focus'

// for your own UI
export { studyList, type ListConceptGroup, type ListStudy, type ListVariable } from './model/list'
export { conceptLink, nodeLinks, NO_VARIABLE_ACCESSION, type KgLink } from './model/links'

// the views
export type { KgView, KgViewOptions } from './views/view'
export { mountGraph, type GraphOptions, type GraphView } from './views/graph'
export {
  flowData,
  mountFlow,
  type FlowData,
  type FlowLink,
  type FlowNode,
  type FlowOptions,
  type FlowView,
} from './views/flow'
