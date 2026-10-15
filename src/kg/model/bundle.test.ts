import { describe, expect, it } from 'vitest'

import { bundles } from './bundle'
import { TWO } from '../test-fixtures'
import { NO_STUDY } from './types'

describe('bundles', () => {
  it('one per concept and study, every variable–concept edge counted once', () => {
    const all = bundles(TWO)
    const keys = all.map((b) => `${b.concept} ${b.study}`)
    expect(new Set(keys).size).toBe(keys.length)
    const type = new Map(TWO.nodes.map((n) => [n.id, n.type]))
    const onConcepts = TWO.edges.filter((e) => type.get(e.target) === 'concept').length
    expect(all.reduce((a, b) => a + b.variables.length, 0)).toBe(onConcepts)
    // a shared study: a bundle from each concept
    expect(all.filter((b) => b.study === 'phs000007').map((b) => b.concept).sort()).toEqual([
      'MONDO:0004979',
      'MONDO:0005002',
    ])
  })

  it('variables without a study bundle to NO_STUDY, after the real studies', () => {
    const all = bundles({
      nodes: [
        { id: 'C', label: 'c', type: 'concept' },
        { id: 'loose', label: 'l', type: 'variable' },
        { id: 'v', label: 'v', type: 'variable' },
        { id: 'w', label: 'w', type: 'variable' },
        { id: 'S', label: 's', type: 'study' },
      ],
      edges: [
        { source: 'loose', target: 'C' },
        { source: 'v', target: 'C' },
        { source: 'v', target: 'S' },
        { source: 'w', target: 'C' },
        { source: 'w', target: 'S' },
      ],
    })
    expect(all).toEqual([
      { concept: 'C', study: 'S', variables: ['v', 'w'] },
      { concept: 'C', study: NO_STUDY, variables: ['loose'] },
    ])
  })
})
