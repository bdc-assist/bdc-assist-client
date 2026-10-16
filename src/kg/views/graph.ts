import cytoscape from 'cytoscape'

import { bridges } from '../model/bridges'
import { DRAW_DEFAULTS, DRAW_OPTIONS, drawnGraph } from '../model/drawn'
import { toElements } from './elements'
import { carryFocus, focusConnections, isPair, sameFocus, type KgFocus } from '../model/focus'
import { arrangeForce as settleForce } from './force'
import { arrangeRadial, type Box } from './radial'
import { styleFor } from './style'
import type { KgGraph } from '../model/types'
import type { KgLayout, KgView, KgViewOptions } from './view'

/** mountGraph's options: the common view options (KgViewOptions), plus: */
export type GraphOptions = KgViewOptions & {
  /** How to arrange the nodes (default 'force'). */
  layout?: KgLayout
  /** Draw each variable (true), or one bundle per concept and study (false, the
   * default): a link as wide as its variables, with variables whose study isn't
   * provided bundled to a "No study provided" placeholder. Clicking a bundle focuses
   * its concept × study pair (without any studies, every bundle goes to the
   * placeholder). */
  variables?: boolean
  /** Zoom with the mouse wheel and pinch. false (default): no, the wheel scrolls
   * the page. 'modifier': only with Ctrl/⌘ held (trackpad pinch counts: browsers
   * send it as Ctrl + wheel), so a plain wheel still scrolls the page around the
   * graph. true: always. zoomBy works either way. */
  zoomGestures?: boolean | 'modifier'
  /** 'modifier' mode: the wheel turned over the graph without Ctrl/⌘ held, so the
   * host can say how to zoom. */
  onZoomHint?: () => void
  /** Where Force has put the nodes, by id. Pass the same (empty) Map to two views of
   * the same graph, e.g. inline and maximized, and the second shows the first's
   * layout, drags included, instead of laying out on its own. It's for one graph: read
   * at mount and by update(), so give update() a new Map along with a new graph. */
  forcePositions?: Map<string, { x: number; y: number }>
}

/** The common view interface (KgView; setOptions: a new layout only rearranges the
 * nodes, collapseVersions, groupSynonyms and sharedOnly redraw, keeping the focus where
 * it can (carryFocus) and calling onFocus when it moves or goes), plus: */
export type GraphView = KgView<GraphOptions> & {
  /** Zoom in (factor > 1) or out (< 1) around the middle of the view. */
  zoomBy(factor: number): void
  /** Show the whole graph. */
  fit(): void
  /** Force: put the nodes back where forcePositions says, after another view sharing
   * it has moved them (e.g. dragged in the maximized one). */
  restorePositions(): void
}

const PADDING = 16

// Force is stable: the same graph always gets the same layout. It starts from Radial
// in this fixed box (not the container's, so inline and maximized start alike), and
// d3-force is deterministic
const FORCE_START: Box = { x1: 0, y1: 0, w: 800, h: 500 }

/**
 * Draw `graph` into `container` (which needs a height). Variables are coloured from
 * --kg-variable-low to --kg-variable-high the more other concepts they link to
 * (related_concepts_count). Seeds get a wide --kg-halo halo and a highlighted label;
 * nodes connecting two or more seeds (shared) get a narrow one.
 * Clicking a node (or focus() from elsewhere, also for a concept × study pair)
 * highlights what it's connected to (see focusConnections) and fades the rest;
 * clicking the background clears it.
 * No framework required; React, Vue or plain HTML hosts all call this the same way.
 */
export function mountGraph(container: HTMLElement, graph: KgGraph, options: GraphOptions = {}): GraphView {
  let opts: GraphOptions = { ...DRAW_DEFAULTS, layout: 'force', ...options }
  let current = graph

  const cy = cytoscape({
    container,
    style: styleFor(container),
    userZoomingEnabled: opts.zoomGestures === true,
    minZoom: 0.1,
    maxZoom: 4,
    boxSelectionEnabled: false,
  })
  let focused: KgFocus | null = null
  // the user picked something (null: the background): highlight it, and tell the host
  function pick(f: KgFocus | null) {
    focused = f
    highlight(f)
    opts.onFocus?.(f)
  }
  // the browser's own tooltip on the canvas, and a pointer over what's clickable
  function hover(title: string, clickable = true) {
    container.title = title
    if (clickable) container.style.cursor = 'pointer'
  }
  function unhover() {
    container.removeAttribute('title')
    container.style.cursor = ''
  }
  cy.on('tap', 'node', (e) => pick({ node: e.target.id() as string }))
  // a bundle: its concept × study pair, like a band in Flow
  cy.on('tap', 'edge.bundle', (e) => pick({ concept: e.target.data('concept') as string, study: e.target.data('study') as string }))
  cy.on('tap', (e) => {
    if (e.target === cy) pick(null)
  })
  // labels on the canvas are cut short ("…"): show the whole one
  cy.on('mouseover', 'node', (e) => hover(String(e.target.data('label'))))
  // a relationship between concepts: name it ("asthma — causes — smoking"). Dug doesn't
  // say which way it reads, so the wording stays neutral.
  cy.on('mouseover', 'edge.relation', (e) => {
    const [s, t] = [e.target.source().data('label'), e.target.target().data('label')]
    const predicate = String(e.target.data('predicate') || 'related to').replace(/_/g, ' ')
    hover(`${s} — ${predicate} — ${t}`, false)
  })
  cy.on('mouseover', 'edge.bundle', (e) => {
    const [s, t] = [e.target.source().data('label'), e.target.target().data('label')]
    const n = e.target.data('count') as number
    hover(`${s} — ${n} ${n === 1 ? 'variable' : 'variables'} — ${t}`)
  })
  cy.on('mouseout', 'node, edge.relation, edge.bundle', unhover)
  // a node dragged in Force stays where it was put, also across redraws
  cy.on('dragfree', 'node', (e) => {
    if (opts.layout === 'force') placed.set(e.target.id(), { ...e.target.position() })
  })

  // 'modifier' zoom: Cytoscape's own wheel zoom is off, so handle Ctrl/⌘ + wheel here
  // (non-passive, to keep the browser from zooming the page instead)
  function onWheel(e: WheelEvent) {
    if (opts.zoomGestures !== 'modifier') return
    if (!(e.ctrlKey || e.metaKey)) return opts.onZoomHint?.()
    e.preventDefault()
    const lines = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1 // Firefox: lines, not pixels
    const box = container.getBoundingClientRect()
    cy.zoom({
      level: cy.zoom() * Math.exp(-e.deltaY * lines * 0.002),
      renderedPosition: { x: e.clientX - box.left, y: e.clientY - box.top },
    })
  }
  container.addEventListener('wheel', onWheel, { passive: false })

  let drawn: KgGraph = graph
  let bundled = false // drawn with bundles instead of variables
  // Force's positions by node id, kept across redraws (Group, Shared only) and drags,
  // and shared with other views given the same forcePositions; a new one for another graph
  let placed = opts.forcePositions ?? new Map<string, { x: number; y: number }>()
  function draw() {
    drawn = drawnGraph(current, opts)
    const shared = bridges(drawn)
    bundled = wantBundles()
    cy.batch(() => {
      cy.elements().remove()
      cy.add(toElements(drawn, bundled))
      // nodes that connect two or more seeds get a halo (`bridge`)
      cy.nodes().forEach((n) => void n.toggleClass('bridge', shared.has(n.id())))
    })
    arrange()
  }

  // bundles unless variables are wanted (or there are none)
  function wantBundles() {
    return !opts.variables && drawn.nodes.some((n) => n.type === 'variable')
  }

  // everything not connected to the focus gets `faded`; null clears it. Worked out on
  // the whole graph (variables included); a bundle stays when its two ends and some
  // of its variables do
  function highlight(focus: KgFocus | null) {
    const c = focus ? focusConnections(drawn, focus) : null
    cy.batch(() => {
      cy.elements().removeClass('faded')
      if (!c?.nodes.size) return
      cy.nodes().forEach((n) => {
        if (!c.nodes.has(n.id())) n.addClass('faded')
      })
      cy.edges().forEach((e) => {
        const on = e.hasClass('bundle')
          ? c.nodes.has(e.data('concept')) &&
            c.nodes.has(e.data('study')) &&
            (e.data('variables') as string[]).some((v) => c.nodes.has(v))
          : c.edges.has(e.id())
        if (!on) e.addClass('faded')
      })
    })
  }

  // a focus from elsewhere (focus(), a redraw): what a tap does, plus the ring
  function show(f: KgFocus | null) {
    focused = f
    cy.batch(() => {
      cy.$(':selected').unselect()
      if (f && !isPair(f)) cy.getElementById(f.node).select() // a pair has no single node to outline
    })
    highlight(f)
  }

  function arrange() {
    if (opts.layout === 'force') return arrangeForce()
    // without a box, breadthfirst spreads over cy.extent(): the visible area at the
    // current zoom. Zoomed out to fit, that's bigger than the container, so every
    // redraw (e.g. toggling sharedOnly) would spread wider and fit smaller. Use the
    // container's own size (a fallback while it's hidden, e.g. in the list view).
    arrangeRadial(cy, { x1: 0, y1: 0, w: container.clientWidth || 600, h: container.clientHeight || 300 })
    cy.fit(undefined, PADDING)
  }

  // Stable Force: if every node has a known place (maximized, dragged, Shared only just
  // hid some), they go there and nothing moves. Otherwise it lays out afresh: from
  // Radial (seeds in the middle) in a fixed box, d3-force per piece, turned wide, the
  // pieces packed side by side (force.ts). So the same graph always looks the same,
  // whatever was shown before.
  function arrangeForce() {
    if (restorePlaced()) return
    arrangeRadial(cy, FORCE_START)
    settleForce(cy)
    cy.fit(undefined, PADDING)
    // only this layout's places: none left over from another, to mix with it later
    placed.clear()
    cy.nodes().forEach((n) => void placed.set(n.id(), { ...n.position() }))
  }

  // every node has a known place: put them there (and fit) and say so
  function restorePlaced(): boolean {
    const nodes = cy.nodes()
    if (nodes.empty() || nodes.filter((n) => !placed.has(n.id())).nonempty()) return false
    cy.batch(() => nodes.forEach((n) => void n.position(placed.get(n.id())!)))
    cy.fit(undefined, PADDING)
    return true
  }

  draw()

  return {
    update(g, o) {
      if (o) opts = { ...opts, ...o }
      current = g
      // another graph: its own stable layout. A shared Map is the host's to replace
      placed = opts.forcePositions ?? new Map()
      focused = null // another graph: the focused node may be gone or renamed
      opts.onFocus?.(null)
      draw()
    },
    setOptions(o) {
      const redraw = DRAW_OPTIONS.some((k) => o[k] !== undefined && o[k] !== opts[k])
      const relayout = o.layout !== undefined && o.layout !== opts.layout
      opts = { ...opts, ...o }
      cy.userZoomingEnabled(opts.zoomGestures === true)
      if (redraw || wantBundles() !== bundled) {
        draw()
        // the focus, on the new drawing: kept, moved to what it's merged into, or gone
        const before = focused
        show(carryFocus(focused, drawn))
        if (!sameFocus(before, focused)) opts.onFocus?.(focused)
      } else if (relayout) arrange()
    },
    focus: show,
    zoomBy(factor) {
      cy.zoom({
        level: cy.zoom() * factor,
        renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 },
      })
    },
    fit() {
      cy.fit(undefined, PADDING)
    },
    restorePositions() {
      if (opts.layout !== 'force') return
      // nothing moved: keep the user's zoom and pan
      const moved = cy.nodes().filter((n) => {
        const [p, q] = [placed.get(n.id()), n.position()]
        return !p || p.x !== q.x || p.y !== q.y
      })
      if (moved.nonempty()) restorePlaced()
    },
    resize() {
      cy.resize()
      cy.fit(undefined, PADDING)
    },
    refreshStyle() {
      cy.style(styleFor(container))
    },
    destroy() {
      container.removeEventListener('wheel', onWheel)
      cy.destroy()
    },
  }
}
