import { describe, expect, it } from 'vitest'

import asthmaCopdFixture from './fixtures/kg/concept_graph_2.json'
import asthmaCopd from './fixtures/graph/concept_graph_2.json'
import chdFixture from './fixtures/kg/concept_graph.json'
import chd from './fixtures/graph/concept_graph.json'
import relatedFixture from './fixtures/kg/concept_connections.json'
import searchFixture from './fixtures/kg/search_concepts.json'
import type { KgGraph } from './types'
import { toElements } from './elements'
import { fromKgList, kgLabel, kgParts } from './wire'

// fixtures/kg/: what the API sends (bdc-assist's Dug interceptor on real Dug results);
// fixtures/graph/: fromKgList of each, made by npm run fixtures
const chdKg = chdFixture.kg
const asthmaCopdKg = asthmaCopdFixture.kg
const relatedKg = relatedFixture.kg
const searchKg = searchFixture.kg
const count = (g: KgGraph, t: string) => g.nodes.filter((n) => n.type === t).length

describe('fromKgList', () => {
  it("merges the interceptor's per-call graphs into the same graph as before", () => {
    for (const [wire, before] of [
      [chdKg, chd],
      [asthmaCopdKg, asthmaCopd],
    ] as const) {
      const g = fromKgList(wire)!
      const b = before as KgGraph
      expect(['concept', 'variable', 'study'].map((t) => count(g, t))).toEqual(
        ['concept', 'variable', 'study'].map((t) => count(b, t)),
      )
      const edges = (x: KgGraph) => x.edges.map((e) => `${e.source}->${e.target}`).sort()
      expect(edges(g)).toEqual(edges(b))
    }
  })

  it("takes the role from today's category, the label from name", () => {
    const g = fromKgList(asthmaCopdKg)!
    expect(g.nodes.find((n) => n.id === 'phs000007.v34.p15')).toEqual({
      id: 'phs000007.v34.p15',
      label: 'Framingham Cohort',
      type: 'study',
    })
    expect(g.nodes.find((n) => n.id === 'MONDO:0004979')).toMatchObject({ type: 'concept', concept_type: 'biolink:NamedThing' })
  })

  it('takes the proposed fields too: type, attributes.related_concepts_count, predicate', () => {
    const g = fromKgList([
      {
        tool: 'get_concept_graph',
        nodes: [
          { id: 'C', name: 'c', type: 'concept', category: 'biolink:Disease' },
          { id: 'D', name: 'd', type: 'concept' },
          { id: 'v', name: 'V', type: 'variable', attributes: { related_concepts_count: 9 } },
        ],
        edges: [
          { subject: 'v', object: 'C' },
          { subject: 'C', object: 'D', predicate: 'related_to' },
        ],
      },
    ])!
    expect(g.nodes).toEqual([
      { id: 'C', label: 'c', type: 'concept', concept_type: 'biolink:Disease' },
      { id: 'D', label: 'd', type: 'concept' },
      { id: 'v', label: 'V', type: 'variable', related_concepts_count: 9 },
    ])
    expect(g.edges).toContainEqual({ source: 'C', target: 'D', predicates: ['related_to'] })
  })

  it('keeps a search term as a term, not a concept (find_cohort_variables)', () => {
    const g = fromKgList([
      {
        tool: 'find_cohort_variables',
        nodes: [
          { id: 'v1', name: 'ASTHMA', type: 'variable' },
          { id: 'COPD', name: 'COPD', type: 'term' },
        ],
        edges: [{ subject: 'v1', object: 'COPD' }],
      },
    ])!
    expect(g.nodes.find((n) => n.id === 'COPD')).toEqual({ id: 'COPD', label: 'COPD', type: 'term' })
    expect(toElements(g).find((e) => e.data.id === 'COPD')?.data.type).toBe('term')
  })

  it('is null for no list, an empty list, or graphs without edges', () => {
    expect(fromKgList(undefined)).toBeNull()
    expect(fromKgList({})).toBeNull()
    expect(fromKgList([])).toBeNull()
    expect(fromKgList([{ tool: 't', nodes: [{ id: 'a' }], edges: [] }])).toBeNull()
  })
})

describe('kgLabel', () => {
  it("names a graph in the user's terms, never by tool", () => {
    expect(kgLabel(asthmaCopdKg[0])).toBe('asthma concept graph')
    expect(kgLabel(asthmaCopdKg[1])).toBe('chronic obstructive pulmonary disease concept graph')
    const entry = (tool: string, args: Record<string, unknown>) => ({ tool, args, nodes: [], edges: [] })
    expect(kgLabel(entry('find_cohort_variables', { concepts: ['asthma', 'copd'], require_all: true }))).toBe(
      'asthma + copd cohort variables',
    )
    expect(kgLabel(entry('search_concepts', { search_term: 'asthma' }))).toBe('asthma concept search')
    expect(kgLabel(entry('some_new_tool', {}))).toBe('some new tool')
  })

  it("prefers the server's label", () => {
    expect(kgLabel({ tool: 'get_concept_graph', label: 'Asthma studies', nodes: [], edges: [] })).toBe('Asthma studies')
  })
})

describe('seeds', () => {
  const seedIds = (g: KgGraph | null) => g!.nodes.filter((n) => n.seed).map((n) => n.id)

  it('marks what each call asked about (real Dug results)', () => {
    expect(seedIds(fromKgList(chdKg))).toEqual(['MONDO:0005453'])
    expect(seedIds(fromKgList(asthmaCopdKg)).sort()).toEqual(['MONDO:0004979', 'MONDO:0005002'])
    expect(seedIds(fromKgList(searchKg))).toEqual([]) // searches ask about no node
  })

  it('combines the seeds of every call, once each', () => {
    // asthma is asked about in both: its concept graph and its related concepts
    const g = fromKgList([...asthmaCopdKg, ...relatedKg])
    expect(seedIds(g).sort()).toEqual(['MONDO:0004979', 'MONDO:0005002'])
  })

  it("gives one call's graph only its own seeds", () => {
    expect(kgParts(asthmaCopdKg).map((p) => seedIds(p.graph))).toEqual([['MONDO:0004979'], ['MONDO:0005002']])
  })

  it('ignores a seed that is not a node', () => {
    const entry = { tool: 't', seeds: ['a', 'nowhere'], nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ subject: 'a', object: 'b' }] }
    expect(seedIds(fromKgList([entry]))).toEqual(['a'])
  })
})

describe('descriptions', () => {
  it("keeps Dug's description (real search_concepts variables)", () => {
    const v = fromKgList(searchKg)!.nodes.find((n) => n.id === 'phs002907_BMI.v1.p1')
    expect(v?.description).toBe('body mass index (kg/m2)')
  })

  it('takes a missing description from a later call', () => {
    const edges = [{ subject: 'v', object: 'c' }]
    const g = fromKgList([
      { tool: 'a', nodes: [{ id: 'v', type: 'variable' }, { id: 'c' }], edges },
      { tool: 'b', nodes: [{ id: 'v', type: 'variable', description: 'later' }, { id: 'c' }], edges },
      { tool: 'c', nodes: [{ id: 'v', type: 'variable', description: 'latest' }, { id: 'c' }], edges },
    ])
    expect(g!.nodes.find((n) => n.id === 'v')?.description).toBe('later')
  })
})

describe('kgParts', () => {
  it('gives each call its own graph and label', () => {
    const parts = kgParts(asthmaCopdKg)
    expect(parts.map((p) => p.label)).toEqual([
      'asthma concept graph',
      'chronic obstructive pulmonary disease concept graph',
    ])
    expect(parts.map((p) => p.graph.nodes.filter((n) => n.type === 'concept').length)).toEqual([1, 1])
  })
})
