import cytoscape, { type EdgeSingular, type LayoutOptions, type StylesheetJson } from 'cytoscape'
import fcose from 'cytoscape-fcose'

import { bridges, sharedOnly } from './bridges'
import { collapseVersions } from './collapse'
import { backgroundOf, haloOf, mix, toRgb } from './colour'
import { groupSynonyms } from './group'
import { toElements } from './elements'
import { carryFocus, focusConnections, isPair, sameFocus, type KgFocus } from './focus'
import { orient } from './orient'
import { arrangeRadial, type Box } from './radial'
import { withSeed } from './seeded'
import type { KgGraph } from './types'
import type { KgView, KgViewOptions } from './view'

// fCoSE: Cytoscape's improved force-directed layout (an extension), for the force view
cytoscape.use(fcose)

/**
 * - radial: the seeds (what was asked about) in the middle, or without seeds the concepts;
 *   their variables around them, studies outside. Separate pieces (e.g. from unrelated
 *   calls) each get their own centre, side by side (see arrangeRadial)
 * - force: a force-directed layout (fCoSE, cytoscape-fcose); clusters form on their own
 */
export const KG_LAYOUTS = ['radial', 'force'] as const
export type KgLayout = (typeof KG_LAYOUTS)[number]

/** mountGraph's options: the common view options (KgViewOptions), plus: */
export type GraphOptions = KgViewOptions & {
  /** How to arrange the nodes (default 'radial'). */
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

// Colours come from CSS custom properties on the container (or any ancestor), so
// a host restyles the graph from its own CSS. Any CSS colour works (see colour.ts).
const COLORS = {
  concept: ['--kg-concept', '#d97706'],
  // variables run from low to high along their weight (related_concepts_count)
  variableLow: ['--kg-variable-low', '#93c5fd'],
  variableHigh: ['--kg-variable-high', '#1e40af'],
  study: ['--kg-study', '#059669'],
  edge: ['--kg-edge', '#cbd5e1'],
  label: ['--kg-label', '#475569'],
  selected: ['--kg-selected', '#0f172a'],
} as const

// halo padding: wide for a seed, narrow for a shared node
const SEED_HALO = 14
const SHARED_HALO = 5

const PADDING = 16

// Force is stable: the same graph always gets the same layout. It starts from Radial
// in this fixed box (not the container's, so inline and maximized start alike), with
// a fixed seed for whatever randomness fcose uses
const FORCE_START: Box = { x1: 0, y1: 0, w: 800, h: 500 }
const FORCE_SEED = 1

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
  let opts: GraphOptions = { collapseVersions: true, groupSynonyms: true, layout: 'radial', ...options }
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
  cy.on('tap', 'node', (e) => {
    focused = { node: e.target.id() as string }
    highlight(focused)
    opts.onFocus?.(focused)
  })
  cy.on('tap', (e) => {
    if (e.target !== cy) return
    focused = null
    highlight(null)
    opts.onFocus?.(null)
  })
  // labels on the canvas are cut short ("…"): show the whole one as the browser's
  // own tooltip, and a pointer, since nodes are clickable
  cy.on('mouseover', 'node', (e) => {
    container.title = String(e.target.data('label'))
    container.style.cursor = 'pointer'
  })
  cy.on('mouseout', 'node', () => {
    container.removeAttribute('title')
    container.style.cursor = ''
  })
  // a relationship between concepts: name it ("asthma — causes — smoking"). Dug doesn't
  // say which way it reads, so the wording stays neutral.
  cy.on('mouseover', 'edge.relation', (e) => {
    const [s, t] = [e.target.source().data('label'), e.target.target().data('label')]
    const predicate = String(e.target.data('predicate') || 'related to').replace(/_/g, ' ')
    container.title = `${s} — ${predicate} — ${t}`
  })
  cy.on('mouseout', 'edge.relation', () => container.removeAttribute('title'))
  // a bundle: its concept × study pair, like a band in Flow
  cy.on('tap', 'edge.bundle', (e) => {
    focused = { concept: e.target.data('concept') as string, study: e.target.data('study') as string }
    highlight(focused)
    opts.onFocus?.(focused)
  })
  cy.on('mouseover', 'edge.bundle', (e) => {
    const [s, t] = [e.target.source().data('label'), e.target.target().data('label')]
    const n = e.target.data('count') as number
    container.title = `${s} — ${n} ${n === 1 ? 'variable' : 'variables'} — ${t}`
    container.style.cursor = 'pointer'
  })
  cy.on('mouseout', 'edge.bundle', () => {
    container.removeAttribute('title')
    container.style.cursor = ''
  })
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
    drawn = opts.collapseVersions ? collapseVersions(current) : current
    if (opts.groupSynonyms) drawn = groupSynonyms(drawn)
    if (opts.sharedOnly) drawn = sharedOnly(drawn) // after merging: it can create bridges
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
  // Radial (seeds in the middle) in a fixed box, fcose with a fixed seed, turned wide.
  // So the same graph always looks the same, whatever was shown before.
  function arrangeForce() {
    if (restorePlaced()) return
    const nodes = cy.nodes()
    arrangeRadial(cy, FORCE_START)
    const layout = cy.layout(forceOptions())
    layout.one('layoutstop', () => {
      orientWide()
      // only this layout's places: none left over from another, to mix with it later
      placed.clear()
      nodes.forEach((n) => void placed.set(n.id(), { ...n.position() }))
    })
    // fcose (cose-base) draws on Math.random when it puts back the tree branches it
    // set aside while settling the rest
    withSeed(FORCE_SEED, () => layout.run()) // synchronous: it doesn't animate
  }

  // every node has a known place: put them there (and fit) and say so
  function restorePlaced(): boolean {
    const nodes = cy.nodes()
    if (nodes.empty() || nodes.filter((n) => !placed.has(n.id())).nonempty()) return false
    cy.batch(() => nodes.forEach((n) => void n.position(placed.get(n.id())!)))
    cy.fit(undefined, PADDING)
    return true
  }

  // force layouts settle at any angle: turn them wide, always (not to the container's
  // shape), so inline and maximized get the same layout whichever runs it
  function orientWide() {
    const nodes = cy.nodes()
    const turned = orient(nodes.map((n) => ({ ...n.position() })), true)
    cy.batch(() => nodes.forEach((n, i) => void n.position(turned[i])))
    cy.fit(undefined, PADDING)
  }

  // fcose from the nodes' current positions (randomize: false), so arrangeForce decides
  // where it starts. The one place that knows it's fcose: another layout could take over
  // as long as it starts from the current positions and runs synchronously
  function forceOptions(): LayoutOptions {
    return {
      name: 'fcose',
      quality: 'proof', // the slower, better pass; our graphs are small (tens of nodes)
      randomize: false,
      animate: false,
      padding: PADDING,
      nodeDimensionsIncludeLabels: true, // keep long study labels from piling up
      nodeRepulsion: 8000,
      idealEdgeLength: 70,
      edgeElasticity: 0.45,
      nodeSeparation: 80,
    } as LayoutOptions // fcose's options aren't in Cytoscape's types
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
      const changed = (k: 'collapseVersions' | 'groupSynonyms' | 'sharedOnly') => o[k] !== undefined && o[k] !== opts[k]
      const redraw = changed('collapseVersions') || changed('groupSynonyms') || changed('sharedOnly')
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

function styleFor(el: HTMLElement): StylesheetJson {
  const css = getComputedStyle(el)
  const color = (key: keyof typeof COLORS) => {
    const [name, fallback] = COLORS[key]
    const value = css.getPropertyValue(name).trim()
    return (value && toRgb(value)) || fallback
  }
  const halo = haloOf(el)
  const background = backgroundOf(el)
  // the concept colour mixed into the background: terms' fill, inter-concept links
  const tint = (amount: number) => mix(background, color('concept'), amount)
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-family': css.fontFamily,
        'font-size': 10,
        color: color('label'),
        'text-valign': 'bottom',
        'text-margin-y': 3,
        'text-wrap': 'ellipsis',
        'text-max-width': '110px',
        width: 12,
        height: 12,
      },
    },
    {
      selector: 'node[type = "concept"], node[type = "term"]',
      style: {
        'background-color': color('concept'),
        width: 24,
        height: 24,
        'font-size': 12,
        'font-weight': 'bold',
        'text-max-width': '200px',
      },
    },
    {
      // a search word standing in for a concept: tinted, with a border in the concept colour
      selector: 'node[type = "term"]',
      style: { 'background-color': tint(0.3), 'border-width': 2, 'border-color': color('concept') },
    },
    {
      selector: 'node[type = "variable"]',
      style: { 'background-color': (n) => mix(color('variableLow'), color('variableHigh'), n.data('weight') ?? 1) },
    },
    {
      selector: 'node[type = "study"]',
      style: { 'background-color': color('study'), shape: 'round-rectangle', width: 16, height: 16 },
    },
    {
      // "No study provided": a stand-in, not a study: outlined in grey, never study green
      selector: 'node.placeholder',
      style: {
        'background-opacity': 0,
        'border-width': 1.5,
        'border-color': color('label'),
      },
    },
    { selector: 'edge', style: { width: 1, 'line-color': color('edge'), 'curve-style': 'straight' } },
    {
      // a concept's variables in one study: flat mid-blue (a summary of variables, as
      // Flow's bands), as wide as there are (area-like: 1 + 2.2·√count)
      selector: 'edge.bundle',
      style: {
        'line-color': mix(color('variableLow'), color('variableHigh'), 0.5),
        width: (e: EdgeSingular) => 1 + 2.2 * Math.sqrt(e.data('count') as number),
      },
    },
    {
      // concept → concept: a light tint of the concept colour (not opacity: that means faded)
      selector: 'edge.relation',
      style: { 'line-color': tint(0.55), width: 1.5 },
    },
    {
      // connects two or more seeds (shared): a narrow halo
      selector: 'node.bridge',
      style: {
        'underlay-color': halo.color,
        'underlay-padding': SHARED_HALO,
        'underlay-opacity': halo.opacity,
        'underlay-shape': 'ellipse',
      },
    },
    {
      // what a call asked about (the API's seeds), of any type: a wide halo, and the
      // label highlighted in the same colour. After .bridge, so a shared seed gets the wide one
      selector: 'node[?seed]',
      style: {
        'underlay-color': halo.color,
        'underlay-padding': SEED_HALO,
        'underlay-opacity': halo.opacity,
        'underlay-shape': 'ellipse',
        'text-background-color': halo.color,
        'text-background-opacity': halo.opacity,
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle', // the types only know the old spelling
        color: halo.text, // black or white, for the highlight as it looks over the background
        'text-margin-y': 5,
      },
    },
    { selector: 'node.bridge[type = "study"], node[?seed][type = "study"]', style: { 'underlay-shape': 'round-rectangle' } },
    { selector: '.faded', style: { opacity: 0.15 } },
    {
      // the focus: a ring outside the node, leaving the border to the node's type (terms)
      selector: 'node:selected',
      style: { 'outline-width': 2, 'outline-color': color('selected'), 'outline-offset': 3, 'outline-opacity': 1 },
    },
  ]
}
