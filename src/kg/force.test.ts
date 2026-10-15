import cytoscape from 'cytoscape'
import { describe, expect, it } from 'vitest'

import { toElements } from './elements'
import chd from './fixtures/kg/concept_graph.json'
import related from './fixtures/kg/concept_connections.json'
import search from './fixtures/kg/search_concepts.json'
import { arrangeForce, settle } from './force'
import { arrangeRadial } from './radial'
import { fromKgList } from './wire'

// as mountGraph's Force: the calls' graphs merged, bundled, from Radial in a fixed box
function laidOut(...calls: { kg: unknown[] }[]) {
  const cy = cytoscape({ headless: true, elements: toElements(fromKgList(calls.flatMap((c) => c.kg))!, true) })
  arrangeRadial(cy, { x1: 0, y1: 0, w: 800, h: 500 })
  arrangeForce(cy)
  return cy
}

const positions = (cy: cytoscape.Core) => cy.nodes().map((n) => [n.id(), n.position()])

// the left and right edges of the nodes' positions
const span = (nodes: cytoscape.NodeCollection) => {
  const xs = nodes.map((n) => n.position('x'))
  return [Math.min(...xs), Math.max(...xs)]
}

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
    expect(positions(laidOut(chd, related))).toEqual(positions(laidOut(chd, related)))
  })

  it('packs separate pieces side by side, seeded first, without overlap', () => {
    const cy = laidOut(search, chd)
    const seeded = cy.nodes('[?seed]').first().component().nodes()
    const other = cy.nodes().difference(seeded)
    expect(span(seeded)[1]).toBeLessThan(span(other)[0])
  })
})
