import { describe, expect, it } from 'vitest'

import { shapeOf } from './shape'
import { chd, related as connections, search } from '../test-fixtures'
import type { KgGraph } from './types'

describe('shapeOf', () => {
  it('says what a graph contains', () => {
    expect(shapeOf(chd as KgGraph)).toEqual({ seeds: 1, variables: true, studies: true, interConceptLinks: false })
    expect(shapeOf(search as KgGraph)).toMatchObject({ seeds: 0, variables: true, studies: false })
    expect(shapeOf(connections as KgGraph)).toMatchObject({ seeds: 1, variables: false, interConceptLinks: true })
  })
})
