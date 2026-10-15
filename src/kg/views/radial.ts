import type { CollectionReturnValue, Core } from 'cytoscape'

export type Box = { x1: number; y1: number; w: number; h: number }

// room left between two pieces laid out side by side
const GAP = 40

/**
 * Radial: each piece of the graph (nodes joined by some path; separate calls can give
 * separate pieces) in rings around its own centre, the pieces side by side in `box`.
 * Pieces with seeds come first, then the bigger; each gets a width by √(its nodes).
 * Doesn't fit the view: the caller does.
 */
export function arrangeRadial(cy: Core, box: Box) {
  const pieces = cy
    .elements()
    .components()
    .sort((a, b) => seeded(b) - seeded(a) || b.nodes().length - a.nodes().length)
  const weights = pieces.map((p) => Math.sqrt(p.nodes().length))
  const total = weights.reduce((a, b) => a + b, 0)
  let x = box.x1
  pieces.forEach((piece, i) => {
    const w = (box.w * weights[i]) / total
    const gap = pieces.length > 1 ? Math.min(GAP, w / 4) : 0
    piece
      .layout({
        name: 'breadthfirst',
        boundingBox: { x1: x + gap / 2, y1: box.y1, w: w - gap, h: box.h },
        roots: radialRoots(piece),
        circle: true,
        depthSort: (a, b) => String(a.data('order')).localeCompare(String(b.data('order'))),
        fit: false,
        animate: false,
      })
      .run()
    x += w
  })
}

const seeded = (piece: CollectionReturnValue) => (piece.nodes('[?seed]').nonempty() ? 1 : 0)

/** A piece's centre: its seeds, so related concepts and the seeds' variables ring them.
 * Without seeds (searches): the concepts with variables; concepts only related to them
 * (no variables of their own) form a ring around them instead of joining the middle. */
export function radialRoots(piece: CollectionReturnValue): string[] {
  const seeds = piece.nodes('[?seed]')
  if (seeds.nonempty()) return seeds.map((n) => n.id())
  const concepts = piece.nodes('[type = "concept"], [type = "term"]')
  // (bundled, concepts link to studies directly)
  const withVariables = concepts.filter((c) => c.neighborhood('node[type = "variable"], node[type = "study"]').nonempty())
  return (withVariables.nonempty() ? withVariables : concepts.nonempty() ? concepts : piece.nodes()).map((n) => n.id())
}
