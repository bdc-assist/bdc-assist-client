import { describe, expect, it } from 'vitest'

import connections from './fixtures/graph/concept_connections.json'
import chd from './fixtures/graph/concept_graph.json'
import search from './fixtures/graph/search_concepts.json'
import { graphShape, shapeOf } from './shape'
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

  it('says why a view is missing: no seed, no studies, no variables', () => {
    expect(graphShape(search as KgGraph).available).toMatchObject({
      radial: 'Needs a concept that was asked about',
      flow: 'Needs studies',
      columns: true,
      force: true,
      list: true,
    })
    expect(graphShape(connections as KgGraph).available).toMatchObject({ columns: 'Needs variables', radial: true })
  })
})
