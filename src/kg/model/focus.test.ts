import { describe, expect, it } from 'vitest'

import { bridges, sharedOnly } from './bridges'
import { collapseVersions } from './collapse'
import { carryFocus, connections, focusConnections, pairVariables, sameFocus, studylessVariables } from './focus'
import { groupSynonyms } from './group'
import { ASTHMA, COPD, FHS, TWO } from '../test-fixtures'
import { NO_STUDY, type KgGraph } from './types'
const on = (target: string) => new Set(TWO.edges.filter((e) => e.target === target).map((e) => e.source))

describe('pairVariables', () => {
  it("is the study's variables on that concept, and only those", () => {
    const vars = pairVariables(TWO, ASTHMA, FHS).map((v) => v.id)
    expect(vars.length).toBeGreaterThan(0)
    expect(vars.every((v) => on(ASTHMA).has(v) && on(FHS).has(v))).toBe(true)
    const both = [...on(FHS)].filter((v) => on(ASTHMA).has(v) || on(COPD).has(v))
    expect(vars.length + pairVariables(TWO, COPD, FHS).length).toBe(both.length) // no variable is on both here
  })
})

describe('focusConnections', () => {
  it('a node: its connections', () => {
    expect(focusConnections(TWO, { node: FHS }).nodes).toContain(COPD) // a shared study reaches both concepts
  })

  it('a pair: the concept, the study and the variables between them, not the other concept', () => {
    const c = focusConnections(TWO, { concept: ASTHMA, study: FHS })
    const vars = pairVariables(TWO, ASTHMA, FHS).map((v) => v.id)
    expect([...c.nodes].sort()).toEqual([ASTHMA, FHS, ...vars].sort())
    expect(c.nodes.has(COPD)).toBe(false)
    expect(c.edges.size).toBe(2 * vars.length)
    expect(c.edges).toContain(`${vars[0]}->${ASTHMA}`)
  })

  it('a pair with nothing between them is empty', () => {
    const onlyCopd = [...new Set(TWO.edges.map((e) => e.target))].find(
      (s) => s.startsWith('phs') && pairVariables(TWO, ASTHMA, s).length === 0,
    )!
    expect(focusConnections(TWO, { concept: ASTHMA, study: onlyCopd }).nodes.size).toBe(0)
  })
})

describe('the "No study provided" placeholder', () => {
  const g: KgGraph = {
    nodes: [
      { id: 'C', label: 'c', type: 'concept' },
      { id: 'D', label: 'd', type: 'concept' },
      { id: 'v', label: 'v', type: 'variable' },
      { id: 'loose', label: 'l', type: 'variable' },
      { id: 'S', label: 's', type: 'study' },
    ],
    edges: [
      { source: 'v', target: 'C' },
      { source: 'v', target: 'S' },
      { source: 'loose', target: 'C' },
      { source: 'loose', target: 'D' },
    ],
  }

  it('its variables are the ones without a study', () => {
    expect([...studylessVariables(g)]).toEqual(['loose'])
    expect(pairVariables(g, 'C', NO_STUDY).map((v) => v.id)).toEqual(['loose'])
    expect(pairVariables(g, 'C', 'S').map((v) => v.id)).toEqual(['v'])
  })

  it('focused: its variables and their concepts', () => {
    const c = focusConnections(g, { node: NO_STUDY })
    expect([...c.nodes].sort()).toEqual([NO_STUDY, 'C', 'D', 'loose'].sort())
    expect(c.edges).toEqual(new Set(['loose->C', 'loose->D']))
  })

  it('lights up with its variables, and as a pair', () => {
    expect(focusConnections(g, { node: 'D' }).nodes).toContain(NO_STUDY)
    expect(focusConnections(g, { node: 'S' }).nodes.has(NO_STUDY)).toBe(false)
    const pair = focusConnections(g, { concept: 'C', study: NO_STUDY })
    expect([...pair.nodes].sort()).toEqual([NO_STUDY, 'C', 'loose'].sort())
    expect(pair.edges).toEqual(new Set(['loose->C']))
  })
})

describe('sameFocus', () => {
  it('compares by value', () => {
    expect(sameFocus({ concept: 'a', study: 'b' }, { concept: 'a', study: 'b' })).toBe(true)
    expect(sameFocus({ node: 'a' }, { concept: 'a', study: 'b' })).toBe(false)
    expect(sameFocus(null, null)).toBe(true)
  })
})

describe('carryFocus', () => {
  // two releases of a study and its variable, and two synonyms linked to both
  const raw: KgGraph = {
    nodes: [
      { id: 'A', label: 'a', type: 'concept' },
      { id: 'B', label: 'b', type: 'concept' },
      { id: 'phv1.v1.p1', label: 'v', type: 'variable' },
      { id: 'phv1.v2.p1', label: 'v', type: 'variable' },
      { id: 'phs1.v1.p1', label: 's', type: 'study' },
      { id: 'phs1.v2.p1', label: 's', type: 'study' },
    ],
    edges: [
      { source: 'phv1.v1.p1', target: 'A' },
      { source: 'phv1.v1.p1', target: 'B' },
      { source: 'phv1.v2.p1', target: 'A' },
      { source: 'phv1.v2.p1', target: 'B' },
      { source: 'phv1.v1.p1', target: 'phs1.v1.p1' },
      { source: 'phv1.v2.p1', target: 'phs1.v2.p1' },
    ],
  }
  const grouped = groupSynonyms(collapseVersions(raw))

  it('keeps a node still drawn, and nothing as nothing', () => {
    expect(carryFocus({ node: 'phs1' }, grouped)).toEqual({ node: 'phs1' })
    expect(carryFocus(null, grouped)).toBeNull()
  })

  it('moves a merged node to what it was merged into', () => {
    expect(carryFocus({ node: 'phs1.v2.p1' }, grouped)).toEqual({ node: 'phs1' })
    expect(carryFocus({ node: 'B' }, grouped)).toEqual({ node: 'A' }) // the group has the first member's id
    expect(carryFocus({ concept: 'B', study: 'phs1.v2.p1' }, grouped)).toEqual({ concept: 'A', study: 'phs1' })
  })

  it('moves a split node to its first release or member', () => {
    expect(carryFocus({ node: 'phs1' }, raw)).toEqual({ node: 'phs1.v1.p1' })
    expect(carryFocus({ node: 'A' }, raw)).toEqual({ node: 'A' })
    expect(carryFocus({ concept: 'A', study: 'phs1' }, raw)).toEqual({ concept: 'A', study: 'phs1.v1.p1' })
  })

  it('drops what Shared only hides', () => {
    const hidden = TWO.nodes.find((n) => n.type === 'study' && !bridges(TWO).has(n.id))!
    const shared = sharedOnly(TWO)
    expect(carryFocus({ node: hidden.id }, shared)).toBeNull()
    expect(carryFocus({ concept: ASTHMA, study: hidden.id }, shared)).toBeNull()
    expect(carryFocus({ node: FHS }, shared)).toEqual({ node: FHS })
  })

  it('keeps the placeholder while it has variables', () => {
    expect(carryFocus({ node: NO_STUDY }, raw)).toBeNull()
    const loose: KgGraph = {
      nodes: [...raw.nodes, { id: 'x', label: 'x', type: 'variable' }],
      edges: [...raw.edges, { source: 'x', target: 'A' }],
    }
    expect(carryFocus({ concept: 'A', study: NO_STUDY }, loose)).toEqual({ concept: 'A', study: NO_STUDY })
  })
})

const type = new Map(TWO.nodes.map((n) => [n.id, n.type]))
const ofType = (ids: Set<string>, t: string) => [...ids].filter((id) => type.get(id) === t)
const variablesOf = (study: string) => TWO.edges.filter((e) => e.target === study).map((e) => e.source)

describe('connections', () => {
  it('a shared study: its variables and both concepts', () => {
    const c = connections(TWO, 'phs000007') // Framingham
    expect(ofType(c.nodes, 'concept').sort()).toEqual([ASTHMA, COPD])
    expect(ofType(c.nodes, 'variable').sort()).toEqual(variablesOf('phs000007').sort())
    expect(ofType(c.nodes, 'study')).toEqual(['phs000007']) // not other studies
  })

  it('a concept: its variables and their studies, not the other concept', () => {
    const c = connections(TWO, COPD)
    expect(ofType(c.nodes, 'concept')).toEqual([COPD])
    const vars = TWO.edges.filter((e) => e.target === COPD).map((e) => e.source)
    expect(ofType(c.nodes, 'variable').sort()).toEqual(vars.sort())
    expect(ofType(c.nodes, 'study')).toContain('phs000007')
  })

  it('a variable: just its concept and its study', () => {
    const v = variablesOf('phs000280')[0] // an ARIC variable
    const c = connections(TWO, v)
    expect(c.nodes.size).toBe(3)
    expect(ofType(c.nodes, 'study')).toEqual(['phs000280'])
    expect(c.edges.size).toBe(2)
  })

  it('names edges like toElements does', () => {
    const v = variablesOf('phs000280')[0]
    expect(connections(TWO, v).edges).toContain(`${v}->phs000280`)
  })

  it('is empty for an unknown id', () => {
    expect(connections(TWO, 'nope').nodes.size).toBe(0)
  })
})
