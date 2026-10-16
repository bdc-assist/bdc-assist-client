import { describe, expect, it } from 'vitest'

import { viewChoices } from './view'
import { chd, related as connections, search } from '../test-fixtures'
import type { KgGraph } from '../model/types'

describe('viewChoices', () => {
  it('offers every view for concept → variable → study, Force first', () => {
    const { views, default: first } = viewChoices(chd as KgGraph)
    expect(Object.values(views).every((a) => a === true)).toBe(true)
    expect(first).toBe('force')
  })

  it('says why a view is missing: no seed, no studies', () => {
    expect(viewChoices(search as KgGraph).views).toMatchObject({
      radial: 'Needs a concept that was asked about',
      flow: 'Needs studies',
      force: true,
      list: true,
    })
    expect(viewChoices(connections as KgGraph).views).toMatchObject({ flow: 'Needs studies', radial: true })
  })
})
