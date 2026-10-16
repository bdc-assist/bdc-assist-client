import type cytoscape from 'cytoscape'
import { describe, expect, it } from 'vitest'

import { arrangeForce, settle } from './force'
import { arrangeRadial } from './radial'
import { bundledCy, chdKg, relatedKg, searchKg, span } from '../test-fixtures'
import type { KgWireEntry } from '../model/wire'

// as mountGraph's Force: from Radial in a fixed box
function laidOut(...calls: KgWireEntry[][]) {
  const cy = bundledCy(...calls)
  arrangeRadial(cy, { x1: 0, y1: 0, w: 800, h: 500 })
  arrangeForce(cy)
  return cy
}

const positions = (cy: cytoscape.Core) => cy.nodes().map((n) => [n.id(), n.position()])

describe('settle', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 1, y: 0 },
    { id: 'c', x: 0, y: 1 },
  ]
  const links = [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'c' },
  ]

  it('gives the same positions every time, and leaves its input alone', () => {
    expect(settle(nodes, links)).toEqual(settle(nodes, links))
    expect(nodes[0]).toEqual({ id: 'a', x: 0, y: 0 })
  })

  it('pushes nodes apart to about the link distance', () => {
    const [a, b] = settle(nodes, links)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(40)
  })
})

describe('arrangeForce', () => {
  it('lays out the same graph the same way', () => {
    expect(positions(laidOut(chdKg, relatedKg))).toEqual(positions(laidOut(chdKg, relatedKg)))
  })

  it('packs separate pieces side by side, seeded first, without overlap', () => {
    const cy = laidOut(searchKg, chdKg)
    const seeded = cy.nodes('[?seed]').first().component().nodes()
    const other = cy.nodes().difference(seeded)
    expect(span(seeded)[1]).toBeLessThan(span(other)[0])
  })
})
