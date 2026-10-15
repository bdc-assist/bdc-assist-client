import { describe, expect, it } from 'vitest'

import { graphShape, shapeOf } from './shape'
import { chd, related as connections, search } from './test-fixtures'
import type { KgGraph } from './types'

describe('shapeOf', () => {
  it('says what a graph contains', () => {
    expect(shapeOf(chd as KgGraph)).toEqual({ seeds: 1, variables: true, studies: true, interConceptLinks: false })
    expect(shapeOf(search as KgGraph)).toMatchObject({ seeds: 0, variables: true, studies: false })
    expect(shapeOf(connections as KgGraph)).toMatchObject({ seeds: 1, variables: false, interConceptLinks: true })
  })
})

describe('graphShape', () => {
  it('offers every view for concept → variable → study, Force first', () => {
    const { available, default: first } = graphShape(chd as KgGraph)
    expect(Object.values(available).every((a) => a === true)).toBe(true)
    expect(first).toBe('force')
  })

  it('says why a view is missing: no seed, no studies', () => {
    expect(graphShape(search as KgGraph).available).toMatchObject({
      radial: 'Needs a concept that was asked about',
      flow: 'Needs studies',
      force: true,
      list: true,
    })
    expect(graphShape(connections as KgGraph).available).toMatchObject({ flow: 'Needs studies', radial: true })
  })
})
