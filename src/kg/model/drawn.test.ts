import { describe, expect, it } from 'vitest'

import { sharedOnly } from './bridges'
import { collapseVersions } from './collapse'
import { drawnGraph } from './drawn'
import { groupSynonyms } from './group'
import { asthmaCopd, FHS, search } from '../test-fixtures'

describe('drawnGraph', () => {
  it('merges releases, then synonyms, by default (real BMI search)', () => {
    expect(drawnGraph(search)).toEqual(groupSynonyms(collapseVersions(search)))
    expect(drawnGraph(search).nodes.length).toBeLessThan(search.nodes.length)
  })

  it('leaves the graph as it is with everything off', () => {
    expect(drawnGraph(search, { collapseVersions: false, groupSynonyms: false })).toBe(search)
  })

  it('reduces to what the seeds share, after merging (real asthma + COPD graph)', () => {
    const drawn = drawnGraph(asthmaCopd, { sharedOnly: true })
    expect(drawn).toEqual(sharedOnly(groupSynonyms(collapseVersions(asthmaCopd))))
    expect(drawn.nodes.some((n) => n.id === FHS)).toBe(true) // Framingham, merged and shared
  })
})
