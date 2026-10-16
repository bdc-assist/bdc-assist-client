import { describe, expect, it } from 'vitest'

import { arrangeRadial, radialRoots } from './radial'
import { bundledCy, chdKg, relatedKg, searchKg, span } from '../test-fixtures'
import type { KgWireEntry } from '../model/wire'

function laidOut(...calls: KgWireEntry[][]) {
  const cy = bundledCy(...calls)
  arrangeRadial(cy, { x1: 0, y1: 0, w: 1000, h: 400 })
  return cy
}

describe('arrangeRadial', () => {
  it('lays out separate pieces side by side, each round its own seed', () => {
    const cy = laidOut(chdKg, relatedKg)
    const pieces = cy.elements().components()
    expect(pieces).toHaveLength(2)
    const [a, b] = pieces.map((p) => span(p.nodes())).sort((p, q) => p[0] - q[0])
    expect(a[1]).toBeLessThan(b[0]) // no overlap
    for (const p of pieces) expect(radialRoots(p)).toEqual(p.nodes('[?seed]').map((n) => n.id()))
  })

  it('puts the seeded piece first, and centres a piece without seeds on its concepts', () => {
    const cy = laidOut(searchKg, chdKg)
    const seeded = cy.nodes('[?seed]').first().component()
    const other = cy.elements().difference(seeded)
    expect(span(seeded.nodes())[1]).toBeLessThan(span(other.nodes())[0])
    expect(radialRoots(other).length).toBeGreaterThan(0)
    expect(radialRoots(other).every((id) => cy.getElementById(id).data('type') === 'concept')).toBe(true)
  })
})
