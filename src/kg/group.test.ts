import { describe, expect, it } from 'vitest'

import { collapseVersions } from './collapse'
import cohort from './fixtures/graph/cohort_variables.json'
import related from './fixtures/graph/concept_connections.json'
import search from './fixtures/graph/search_concepts.json'
import { groupSynonyms } from './group'
import type { KgGraph } from './types'

// search_concepts for "body mass index": every variable linked to the same 9 concepts
const SEARCH = collapseVersions(search as KgGraph)

describe('groupSynonyms', () => {
  it("merges a search's synonyms into one node (real BMI search)", () => {
    const g = groupSynonyms(SEARCH)
    const concepts = g.nodes.filter((n) => n.type === 'concept')
    expect(concepts).toHaveLength(1)
    const [group] = concepts
    const first = SEARCH.nodes.find((n) => n.type === 'concept')!
    expect(group.id).toBe(first.id)
    expect(group.label).toBe(`${first.label} + 8 more`)
    expect(group.grouped?.map((c) => c.id)).toEqual(SEARCH.nodes.filter((n) => n.type === 'concept').map((n) => n.id))
    // one edge from each variable to the group, none left to the others
    const variables = g.nodes.filter((n) => n.type === 'variable')
    expect(g.edges).toHaveLength(variables.length)
    expect(g.edges.every((e) => e.target === group.id)).toBe(true)
  })

  it('leaves concepts without variables alone (real related concepts: a star)', () => {
    const g = related as KgGraph
    expect(groupSynonyms(g)).toBe(g)
  })

  it('never merges search terms (real cohort search)', () => {
    const g = collapseVersions(cohort as KgGraph)
    expect(groupSynonyms(g).nodes.filter((n) => n.type === 'term')).toHaveLength(2)
  })

  const mesh = (extra: Partial<Record<'A' | 'B' | 'C', object>> = {}): KgGraph => ({
    nodes: [
      { id: 'A', label: 'a', type: 'concept', ...extra.A },
      { id: 'B', label: 'b', type: 'concept', ...extra.B },
      { id: 'C', label: 'c', type: 'concept', ...extra.C },
      { id: 'v1', label: 'v1', type: 'variable' },
      { id: 'v2', label: 'v2', type: 'variable' },
    ],
    edges: ['A', 'B', 'C'].flatMap((c) => [
      { source: 'v1', target: c, predicates: [`p${c}`] },
      { source: 'v2', target: c },
    ]),
  })

  it("keeps every predicate of the merged concepts' edges", () => {
    const g = groupSynonyms(mesh())
    expect(g.edges).toEqual([
      { source: 'v1', target: 'A', predicates: ['pA', 'pB', 'pC'] },
      { source: 'v2', target: 'A' },
    ])
  })

  it('never merges a seed: it stays on its own, the others group', () => {
    const g = groupSynonyms(mesh({ A: { seed: true } }))
    expect(g.nodes.filter((n) => n.type === 'concept').map((n) => [n.id, n.label])).toEqual([
      ['A', 'a'],
      ['B', 'b + 1 more'],
    ])
  })

  it('keeps concepts with different neighbours apart', () => {
    const g = mesh()
    g.edges = g.edges.filter((e) => !(e.source === 'v2' && e.target === 'C')) // C: only v1
    expect(groupSynonyms(g).nodes.filter((n) => n.type === 'concept').map((n) => n.label)).toEqual(['a + 1 more', 'c'])
  })

  it('leaves the input alone', () => {
    const g = mesh()
    const before = JSON.stringify(g)
    groupSynonyms(g)
    expect(JSON.stringify(g)).toBe(before)
  })
})
