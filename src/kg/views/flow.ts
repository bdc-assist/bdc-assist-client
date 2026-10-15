import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from 'd3-sankey'

import { bridges } from '../model/bridges'
import { bundles } from '../model/bundle'
import { haloOf } from './colour'
import { DRAW_DEFAULTS, DRAW_OPTIONS, drawnGraph } from '../model/drawn'
import { carryFocus, focusConnections, isPair, sameFocus, type KgFocus } from '../model/focus'
import { isConceptOrTerm, NO_STUDY, NO_STUDY_LABEL, type KgGraph, type KgNode } from '../model/types'
import type { KgView, KgViewOptions } from './view'

// a concept or a study, or the "No study provided" placeholder (id NO_STUDY, placeholder: true)
export type FlowNode = { id: string; node: KgNode; placeholder?: true }
export type FlowLink = { source: string; target: string; variables: string[] } // concept → study
export type FlowData = { nodes: FlowNode[]; links: FlowLink[] }

/**
 * The graph as flows from concepts to studies: one link per concept and study,
 * carrying the study's variables on that concept (its width). A variable on two
 * concepts counts in both. Only studies with variables appear; concepts and links
 * keep graph order. Variables whose study isn't provided (studylessVariables) flow to the
 * "No study provided" placeholder, last, but only alongside real studies: with none
 * (e.g. search_concepts) there's nothing to draw.
 */
export function flowData(graph: KgGraph): FlowData {
  const all = bundles(graph)
  if (all.every((b) => b.study === NO_STUDY)) return { nodes: [], links: [] }
  const links = all.map((b) => ({ source: b.concept, target: b.study, variables: b.variables }))
  const used = new Set(links.flatMap((l) => [l.source, l.target]))
  const nodes: FlowNode[] = graph.nodes.filter((n) => used.has(n.id)).map((n) => ({ id: n.id, node: n }))
  if (used.has(NO_STUDY)) {
    nodes.push({ id: NO_STUDY, node: { id: NO_STUDY, label: NO_STUDY_LABEL, type: 'study' }, placeholder: true })
  }
  return { nodes, links }
}

export type FlowOptions = KgViewOptions
export type FlowView = KgView<FlowOptions>

type SNode = SankeyNode<FlowNode, FlowLink & { value: number }>
type SLink = SankeyLink<FlowNode, FlowLink & { value: number }>

const SVG = 'http://www.w3.org/2000/svg'
const NODE_WIDTH = 10
const FADED = '0.15'
// halo around a bar, as in mountGraph but scaled to the bars: wide for a seed, narrow for shared
const SEED_HALO = 6
const SHARED_HALO = 3
const RING = 3 // the focus's ring: this far outside its bar

// colours: the same --kg-* custom properties as mountGraph; SVG takes them as-is.
// Bands are bundles of variables, so they're blue: the middle of the variable ramp.
const fill = {
  concept: 'var(--kg-concept, #d97706)',
  term: 'color-mix(in srgb, var(--kg-concept, #d97706) 30%, transparent)', // tinted, with a border
  study: 'var(--kg-study, #059669)',
  band: 'color-mix(in srgb, var(--kg-variable-low, #93c5fd), var(--kg-variable-high, #1e40af))',
  selected: 'var(--kg-selected, #0f172a)',
  placeholder: 'var(--kg-label, #475569)',
} as const

/**
 * Draw `graph` into `container` (which needs a size) as a Sankey diagram: concepts
 * on the left, studies on the right, each concept → study band as wide as the
 * study's variables on that concept (layout by d3-sankey, drawn as plain SVG).
 * Clicking a concept or study focuses it, a band its concept × study pair; what the
 * focus connects stays, the rest fades (see focusConnections); clicking the
 * background clears it. Same interface as mountGraph, so a host can switch between
 * them. No framework required.
 */
export function mountFlow(container: HTMLElement, graph: KgGraph, options: FlowOptions = {}): FlowView {
  let opts: FlowOptions = { ...DRAW_DEFAULTS, ...options }
  let current = graph
  let drawn: KgGraph = graph
  let data: FlowData = { nodes: [], links: [] }
  let focused: KgFocus | null = null

  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('role', 'img')
  svg.style.display = 'block'
  svg.style.font = 'inherit'
  container.append(svg)
  svg.addEventListener('click', (e) => {
    // a band (data-concept, data-study) or a bar (data-id)
    const hit = (e.target as Element).closest<SVGElement>('[data-id], [data-concept]')
    const { id, concept, study } = hit?.dataset ?? {}
    const f: KgFocus | null = concept && study ? { concept, study } : id ? { node: id } : null
    focus(f)
    opts.onFocus?.(f)
  })

  function prepare() {
    drawn = drawnGraph(current, opts)
    data = flowData(drawn)
    focused = carryFocus(focused, drawn) // kept, moved to what it's merged into, or gone
  }

  function render() {
    const width = container.clientWidth || 600
    const height = container.clientHeight || 300
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.replaceChildren()
    if (!data.links.length) return
    // room for labels: concepts' on the left, studies' (longer) on the right
    const left = Math.min(150, width * 0.22)
    const right = Math.min(260, width * 0.38)
    const padding = Math.max(2, Math.min(10, height / (data.nodes.length * 3)))
    const layout = sankey<FlowNode, FlowLink & { value: number }>()
      .nodeId((n) => n.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(padding)
      .extent([
        [left, 8],
        [width - right, height - 8],
      ])
    const laid = layout({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l, value: l.variables.length })),
    })
    if (placeLast(laid.nodes, NO_STUDY, padding)) layout.update(laid) // its bands follow it
    const { nodes, links } = laid
    const path = sankeyLinkHorizontal()
    const g = (cls: string) => {
      const el = svg.appendChild(document.createElementNS(SVG, 'g'))
      el.setAttribute('class', cls)
      return el
    }
    const bands = g('kg-flow-links')
    for (const l of links as SLink[]) {
      const [s, t] = [l.source as SNode, l.target as SNode]
      const el = bands.appendChild(document.createElementNS(SVG, 'path'))
      el.setAttribute('d', path(l) ?? '')
      Object.assign(el.dataset, { concept: s.id, study: t.id })
      Object.assign(el.style, { fill: 'none', stroke: fill.band, strokeOpacity: '0.45', strokeWidth: String(Math.max(1, l.width ?? 1)), cursor: 'pointer' })
      title(el, `${s.node.label} → ${t.node.label}: ${l.value} variable${l.value === 1 ? '' : 's'}`)
    }
    const boxes = g('kg-flow-nodes')
    const halo = haloOf(container)
    const shared = bridges(drawn)
    for (const n of nodes as SNode[]) {
      const [x0, y0, x1, y1] = [n.x0 ?? 0, n.y0 ?? 0, n.x1 ?? 0, n.y1 ?? 0]
      const [w, h] = [x1 - x0, Math.max(1, y1 - y0)]
      const isConcept = isConceptOrTerm(n.node.type)
      const item = boxes.appendChild(document.createElementNS(SVG, 'g'))
      item.setAttribute('data-id', n.id)
      item.style.cursor = 'pointer'
      // what a call asked about (any type): a wide halo; connects two or more seeds: a narrow one
      const pad = n.node.seed ? SEED_HALO : shared.has(n.id) ? SHARED_HALO : 0
      if (pad) {
        rect(item, { x: x0 - pad, y: y0 - pad, width: w + 2 * pad, height: h + 2 * pad, rx: pad }, {
          fill: halo.color,
          fillOpacity: String(halo.opacity),
        })
      }
      const bar = rect(item, { x: x0, y: y0, width: w, height: h, rx: 2 }, { fill: isConcept ? fill.concept : fill.study })
      // a search word standing in for a concept: tinted, with a border in the concept colour
      if (n.node.type === 'term') Object.assign(bar.style, { fill: fill.term, stroke: fill.concept, strokeWidth: '1.5' })
      // "No study provided": outlined in grey, never study green; transparent, not none, so
      // all of it takes clicks
      if (n.placeholder) Object.assign(bar.style, { fill: 'transparent', stroke: fill.placeholder, strokeWidth: '1.5' })
      // the focus's ring, shown by highlight(); clicks go to the bar
      const ring = rect(item, { x: x0 - RING, y: y0 - RING, width: w + 2 * RING, height: h + 2 * RING, rx: 4 }, {
        fill: 'none',
        stroke: fill.selected,
        strokeWidth: '2',
        pointerEvents: 'none',
        display: 'none',
      })
      ring.dataset.ring = ''
      const gap = 6 + pad
      const text = item.appendChild(document.createElementNS(SVG, 'text'))
      text.setAttribute('x', String(isConcept ? x0 - gap : x1 + gap))
      text.setAttribute('y', String((y0 + y1) / 2))
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('text-anchor', isConcept ? 'end' : 'start')
      Object.assign(text.style, { fill: 'var(--kg-label, #475569)', fontSize: isConcept ? '12px' : '10px', fontWeight: isConcept ? '600' : '400' })
      const chars = ((isConcept ? left : right) - gap - 4) / (isConcept ? 6.5 : 5.5)
      text.textContent = clip(n.node.label, chars)
      // a seed's label is highlighted in the halo colour, as in mountGraph
      if (n.node.seed) {
        text.style.fill = halo.text
        const box = textBox(text, chars * (isConcept ? 6.5 : 5.5))
        const marker = rect(item, { x: box.x - 2, y: box.y - 1, width: box.width + 4, height: box.height + 2, rx: 3 }, {
          fill: halo.color,
          fillOpacity: String(halo.opacity),
        })
        item.insertBefore(marker, text)
      }
      title(item, `${n.node.label} (${n.value} variable${n.value === 1 ? '' : 's'})`)
    }
    highlight()
  }

  // like mountGraph: what the focus connects stays, the rest fades. A band stays when
  // both its ends do, which for a pair is just its own band.
  function highlight() {
    const linked = focused ? focusConnections(drawn, focused).nodes : null
    const outlined = focused && !isPair(focused) ? focused.node : null
    svg.querySelectorAll<SVGElement>('.kg-flow-nodes [data-id]').forEach((el) => {
      el.style.opacity = linked && !linked.has(el.dataset.id ?? '') ? FADED : ''
      const ring = el.querySelector<SVGElement>('[data-ring]')
      if (ring) ring.style.display = el.dataset.id === outlined ? '' : 'none'
    })
    svg.querySelectorAll<SVGElement>('[data-concept]').forEach((el) => {
      const { concept = '', study = '' } = el.dataset
      el.style.opacity = linked && !(linked.has(concept) && linked.has(study)) ? FADED : ''
    })
  }

  function focus(f: KgFocus | null) {
    focused = f
    highlight()
  }

  prepare()
  render()

  return {
    update(g, o) {
      if (o) opts = { ...opts, ...o }
      current = g
      focused = null // another graph: the focused node may be gone or renamed
      opts.onFocus?.(null)
      prepare()
      render()
    },
    setOptions(o) {
      const redraw = DRAW_OPTIONS.some((k) => o[k] !== undefined && o[k] !== opts[k])
      opts = { ...opts, ...o }
      if (!redraw) return
      const before = focused
      prepare()
      render()
      if (!sameFocus(before, focused)) opts.onFocus?.(focused)
    },
    focus,
    resize: render, // laid out for the container's size: text stays sharp
    // colours are CSS variables, so they follow on their own; but a seed label's text
    // (black or white) is worked out from the background
    refreshStyle: render,
    destroy() {
      svg.remove()
    },
  }
}

/** Move node `id` to the bottom of its column, which d3-sankey orders to reduce
 * crossings: the nodes below it move up to close the gap. True if it moved. */
function placeLast(nodes: SNode[], id: string, padding: number): boolean {
  const node = nodes.find((n) => n.id === id)
  if (!node) return false
  const column = nodes.filter((n) => n.x0 === node.x0) // a column shares its x (its layer isn't in the types)
  const bottom = Math.max(...column.map((n) => n.y1 ?? 0))
  const [y0, y1] = [node.y0 ?? 0, node.y1 ?? 0]
  if (y1 >= bottom) return false
  const shift = y1 - y0 + padding
  for (const n of column) {
    if (n === node || (n.y0 ?? 0) < y0) continue
    n.y0 = (n.y0 ?? 0) - shift
    n.y1 = (n.y1 ?? 0) - shift
  }
  node.y0 = bottom - (y1 - y0)
  node.y1 = bottom
  return true
}

function rect(parent: Element, attrs: Record<string, number>, style: Partial<CSSStyleDeclaration>): SVGRectElement {
  const el = parent.appendChild(document.createElementNS(SVG, 'rect'))
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  Object.assign(el.style, style)
  return el
}

/** A text's box; estimated (from `width`, its room) while it can't be measured, e.g. hidden. */
function textBox(text: SVGTextElement, width: number): { x: number; y: number; width: number; height: number } {
  try {
    const box = text.getBBox()
    if (box.width) return box
  } catch {
    // Firefox throws for an element that isn't rendered
  }
  const [x, y] = [Number(text.getAttribute('x')), Number(text.getAttribute('y'))]
  const size = Number.parseFloat(text.style.fontSize) || 10
  const w = Math.min(width, (text.textContent?.length ?? 0) * size * 0.55)
  return { x: text.getAttribute('text-anchor') === 'end' ? x - w : x, y: y - size * 0.6, width: w, height: size * 1.2 }
}

function title(el: Element, text: string) {
  el.appendChild(document.createElementNS(SVG, 'title')).textContent = text
}

/** Cut a label to about `chars` characters, with "…" (SVG text doesn't do it itself). */
function clip(label: string, chars: number): string {
  const n = Math.max(4, Math.floor(chars))
  return label.length > n ? `${label.slice(0, n - 1)}…` : label
}
