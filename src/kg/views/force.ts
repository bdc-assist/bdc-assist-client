import type { Core, EdgeCollection, NodeCollection } from 'cytoscape'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force'

import { orient, type Position } from './orient'

// d3-force's settings, picked side by side with other layouts (design/force-layouts.html)
const LINK_DISTANCE = 70
const CHARGE = -250
const COLLIDE = 28 // node radius for overlap: room for the node, not its label
const CENTRE = 0.03 // the pull towards where the piece started, keeping it together
const TICKS = 300
// room left between two pieces packed side by side
const PIECE_GAP = 60

export type ForceNode = { id: string } & Position
export type ForceLink = { source: string; target: string }

/**
 * Run d3-force on one connected piece, from the nodes' positions: links pull, nodes
 * push apart and don't overlap, and a gentle pull towards where they started keeps
 * the piece in place. Synchronous, and deterministic: d3-force's randomness is its own
 * fixed generator, and the result depends only on the input (order included).
 * Returns the new positions, in the nodes' order. Pure: the input is not modified.
 */
export function settle(nodes: ForceNode[], links: ForceLink[]): Position[] {
  const sim: (ForceNode & SimulationNodeDatum)[] = nodes.map((n) => ({ ...n }))
  const mean = (k: 'x' | 'y') => sim.reduce((a, n) => a + n[k], 0) / sim.length
  const [cx, cy] = [mean('x'), mean('y')]
  forceSimulation(sim)
    .force(
      'link',
      forceLink<(typeof sim)[number], ForceLink>(links.map((l) => ({ ...l })))
        .id((n) => n.id)
        .distance(LINK_DISTANCE),
    )
    .force('charge', forceManyBody().strength(CHARGE))
    .force('collide', forceCollide(COLLIDE))
    .force('x', forceX(cx).strength(CENTRE))
    .force('y', forceY(cy).strength(CENTRE))
    .stop()
    .tick(TICKS)
  return sim.map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 }))
}

/**
 * Force: each piece of the graph (nodes joined by some path) settled on its own from
 * where the nodes are now (arrangeRadial's start), turned wide, then the pieces packed
 * side by side in the order they started in, left to right, PIECE_GAP apart and
 * centred on one line. Packing keeps separate pieces close: settled together, nothing
 * would hold them, and they'd drift apart. Doesn't fit the view: the caller does.
 */
export function arrangeForce(cy: Core) {
  const pieces = cy
    .elements()
    .components()
    .sort((a, b) => a.nodes().boundingBox().x1 - b.nodes().boundingBox().x1)
  let x = 0
  for (const piece of pieces) {
    // in graph order, not the order components() walks it: the result depends on it
    const nodes: NodeCollection = cy.nodes().filter((n) => piece.has(n))
    const links: EdgeCollection = cy.edges().filter((e) => piece.has(e))
    const settled = settle(
      nodes.map((n) => ({ id: n.id(), ...n.position() })),
      links.map((e) => ({ source: e.source().id(), target: e.target().id() })),
    )
    const turned = orient(settled, true) // force layouts settle at any angle
    cy.batch(() => nodes.forEach((n, i) => void n.position(turned[i])))
    const box = nodes.boundingBox({ includeLabels: true })
    const [dx, dy] = [x - box.x1, -(box.y1 + box.h / 2)]
    cy.batch(() => nodes.forEach((n) => void n.position({ x: n.position('x') + dx, y: n.position('y') + dy })))
    x += box.w + PIECE_GAP
  }
}
