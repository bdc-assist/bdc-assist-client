// What the tests share: real Dug results through bdc-assist's interceptor. fixtures/kg/ is
// what the API sends (one entry per tool call); fixtures/graph/ is fromKgList of each,
// made by npm run fixtures. Only tests import this.
import cytoscape from 'cytoscape'

import { collapseVersions } from './model/collapse'
import { toElements } from './views/elements'
import cohortFixture from './fixtures/kg/cohort_variables.json'
import relatedFixture from './fixtures/kg/concept_connections.json'
import chdFixture from './fixtures/kg/concept_graph.json'
import asthmaCopdFixture from './fixtures/kg/concept_graph_2.json'
import searchFixture from './fixtures/kg/search_concepts.json'
import cohortGraph from './fixtures/graph/cohort_variables.json'
import relatedGraph from './fixtures/graph/concept_connections.json'
import chdGraph from './fixtures/graph/concept_graph.json'
import asthmaCopdGraph from './fixtures/graph/concept_graph_2.json'
import searchGraph from './fixtures/graph/search_concepts.json'
import type { KgGraph } from './model/types'
import { fromKgList, type KgWireEntry } from './model/wire'

// what the API sends, per fixture
export const chdKg = chdFixture.kg as KgWireEntry[] // get_concept_graph: congenital heart disease
export const asthmaCopdKg = asthmaCopdFixture.kg as KgWireEntry[] // get_concept_graph: asthma, then COPD
export const relatedKg = relatedFixture.kg as KgWireEntry[] // get_concept_connections: asthma
export const cohortKg = cohortFixture.kg as KgWireEntry[] // find_cohort_variables: search terms asthma, COPD
export const searchKg = searchFixture.kg as KgWireEntry[] // search_concepts: body mass index, no seeds

// the same, merged (fromKgList), as stored in fixtures/graph/
export const chd = chdGraph as KgGraph
export const asthmaCopd = asthmaCopdGraph as KgGraph
export const related = relatedGraph as KgGraph
export const cohort = cohortGraph as KgGraph
export const search = searchGraph as KgGraph

// collapsed, as the views draw them by default
export const CHD = collapseVersions(chd)
export const TWO = collapseVersions(asthmaCopd) // two seeds
export const COHORT = collapseVersions(cohort) // search terms, not concepts
export const SEARCH = collapseVersions(search) // no seeds

export const ASTHMA = 'MONDO:0004979'
export const COPD = 'MONDO:0005002'
export const FHS = 'phs000007' // Framingham, shared by asthma and COPD

export const count = (g: KgGraph, type: string) => g.nodes.filter((n) => n.type === type).length

/** The calls' graphs merged and drawn bundled (as Radial and Force draw them by
 * default), in a headless Cytoscape, not laid out yet. */
export function bundledCy(...calls: KgWireEntry[][]): cytoscape.Core {
  return cytoscape({ headless: true, elements: toElements(fromKgList(calls.flat())!, true) })
}

/** The left and right edges of the nodes' positions. */
export function span(nodes: cytoscape.NodeCollection): [number, number] {
  const xs = nodes.map((n) => n.position('x'))
  return [Math.min(...xs), Math.max(...xs)]
}
