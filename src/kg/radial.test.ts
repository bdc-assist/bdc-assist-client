import cytoscape from 'cytoscape'
import { describe, expect, it } from 'vitest'

import { toElements } from './elements'
import chd from './fixtures/kg/concept_graph.json'
import related from './fixtures/kg/concept_connections.json'
import search from './fixtures/kg/search_concepts.json'
import { arrangeRadial, radialRoots } from './radial'
import { fromKgList } from './wire'

const BOX = { x1: 0, y1: 0, w: 1000, h: 400 }

// the calls' graphs merged, drawn bundled as Radial draws them by default, and laid out
function laidOut(...calls: { kg: unknown[] }[]) {
  const cy = cytoscape({ headless: true, elements: toElements(fromKgList(calls.flatMap((c) => c.kg))!, true) })
  arrangeRadial(cy, BOX)
  return cy
}

// the left and right edges of the nodes' positions
const span = (nodes: cytoscape.NodeCollection) => {
  const xs = nodes.map((n) => n.position('x'))
  return [Math.min(...xs), Math.max(...xs)]
}

describe('arrangeRadial', () => {
  it('lays out separate pieces side by side, each round its own seed', () => {
    const cy = laidOut(chd, related)
    const pieces = cy.elements().components()
    expect(pieces).toHaveLength(2)
    const [a, b] = pieces.map((p) => span(p.nodes())).sort((p, q) => p[0] - q[0])
    expect(a[1]).toBeLessThan(b[0]) // no overlap
    for (const p of pieces) expect(radialRoots(p)).toEqual(p.nodes('[?seed]').map((n) => n.id()))
  })

  it('puts the seeded piece first, and centres a piece without seeds on its concepts', () => {
    const cy = laidOut(search, chd)
    const seeded = cy.nodes('[?seed]').first().component()
    const other = cy.elements().difference(seeded)
    expect(span(seeded.nodes())[1]).toBeLessThan(span(other.nodes())[0])
    expect(radialRoots(other).length).toBeGreaterThan(0)
    expect(radialRoots(other).every((id) => cy.getElementById(id).data('type') === 'concept')).toBe(true)
  })
})
