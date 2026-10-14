import { describe, expect, it } from 'vitest'

import { collapseVersions } from './collapse'
import asthmaCopd from './fixtures/graph/concept_graph_2.json'
import { focusConnections, pairVariables, sameFocus, studylessVariables } from './focus'
import { NO_STUDY, type KgGraph } from './types'

const TWO = collapseVersions(asthmaCopd as KgGraph)
const ASTHMA = 'MONDO:0004979'
const COPD = 'MONDO:0005002'
const FHS = 'phs000007'
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
