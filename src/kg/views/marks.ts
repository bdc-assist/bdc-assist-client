// Every colour and amount the views draw with (DESIGN.md §4), in one place. Colours come
// from --kg-* custom properties on the container or any ancestor, as any CSS colour;
// unset ones use the defaults here. The same marks in two forms: KG_CSS, CSS strings for
// SVG and HTML (Flow, a host's legend or list), and resolvedColors(el), plain rgb() for
// Cytoscape, which can't read var() or parse e.g. oklch() (toRgb converts through a canvas).

/** The --kg-* custom properties and their defaults. */
export const KG_PROPERTIES = {
  concept: ['--kg-concept', '#d97706'],
  // variables run from low to high along their weight (related_concepts_count)
  variableLow: ['--kg-variable-low', '#93c5fd'],
  variableHigh: ['--kg-variable-high', '#1e40af'],
  study: ['--kg-study', '#059669'],
  edge: ['--kg-edge', '#cbd5e1'],
  label: ['--kg-label', '#475569'],
  selected: ['--kg-selected', '#0f172a'],
  // seeds and shared nodes: a halo (and the seeds' label highlight) in a highlighter
  // colour that isn't a type's, since a seed can be of any type
  halo: ['--kg-halo', '#fde047'],
} as const
type ColorKey = keyof typeof KG_PROPERTIES

// a number, not a colour: pale halos need more on light backgrounds, less on dark ones
const HALO_OPACITY = ['--kg-halo-opacity', 0.45] as const

/** How much of what: mixes (0..1 of the second colour) and opacities. */
export const AMOUNTS = {
  term: 0.3, // a search term's fill: concept colour over the background (its border is full)
  relation: 0.55, // an inter-concept link: the same
  band: 0.5, // a bundle of variables: the middle of the variable ramp
  flowBand: 0.45, // Flow's bands overlap: this opaque
  faded: 0.15, // not connected to the focus
  listFaded: 0.35, // the same in a list: text to read
} as const

/** Halo padding, wide for a seed and narrow for shared, scaled to each view's marks. */
export const HALO_PAD = {
  graph: { seed: 14, shared: 5 },
  flow: { seed: 6, shared: 3 }, // Flow's bars are thin
} as const

const v = (key: ColorKey) => `var(${KG_PROPERTIES[key][0]}, ${KG_PROPERTIES[key][1]})`
const percent = (t: number) => `${Math.round(t * 100)}%`
const variable = (weight: number) => `color-mix(in srgb, ${v('variableHigh')} ${percent(weight)}, ${v('variableLow')})`
const band = variable(AMOUNTS.band)

/** The marks as CSS values, for SVG and HTML: Flow, and a host's legend or list, so they
 * match the views. They follow the --kg-* properties wherever they're used. */
export const KG_CSS = {
  concept: v('concept'),
  term: `color-mix(in srgb, ${v('concept')} ${percent(AMOUNTS.term)}, transparent)`, // with a concept-colour border
  study: v('study'),
  label: v('label'),
  selected: v('selected'),
  /** A variable by its weight (variableWeights, 0..1). */
  variable,
  variableLow: v('variableLow'),
  variableHigh: v('variableHigh'),
  band, // node-link's bundles
  flowBand: `color-mix(in srgb, ${band} ${percent(AMOUNTS.flowBand)}, transparent)`,
  /** The halo at its opacity: seeds' and shared nodes' halos, seeds' label highlight. */
  halo: `color-mix(in srgb, ${v('halo')} calc(var(${HALO_OPACITY[0]}, ${HALO_OPACITY[1]}) * 100%), transparent)`,
  placeholder: v('label'), // "No study provided": outlined in this
  faded: String(AMOUNTS.faded),
  listFaded: String(AMOUNTS.listFaded),
} as const

/** The marks' colours as `el` sees them, as "rgb(r, g, b)": for Cytoscape. */
export function resolvedColors(el: HTMLElement) {
  const css = getComputedStyle(el)
  const color = (key: ColorKey) => {
    const [name, fallback] = KG_PROPERTIES[key]
    const value = css.getPropertyValue(name).trim()
    return (value && toRgb(value)) || fallback
  }
  const [concept, low, high] = [color('concept'), color('variableLow'), color('variableHigh')]
  const background = backgroundOf(el)
  return {
    concept,
    study: color('study'),
    edge: color('edge'),
    label: color('label'),
    selected: color('selected'),
    // the concept colour mixed into the background
    term: mix(background, concept, AMOUNTS.term),
    relation: mix(background, concept, AMOUNTS.relation),
    variable: (weight: number) => mix(low, high, weight),
    band: mix(low, high, AMOUNTS.band),
    halo: haloOf(el),
  }
}

/** The halo as `el` sees it: its colour ("rgb(r, g, b)"), opacity, and the text colour
 * (black or white) that reads on a label highlighted with it over the background. */
export function haloOf(el: HTMLElement): { color: string; opacity: number; text: string } {
  const css = getComputedStyle(el)
  const [name, fallback] = KG_PROPERTIES.halo
  const value = css.getPropertyValue(name).trim()
  const color = (value && toRgb(value)) || fallback
  const parsed = Number.parseFloat(css.getPropertyValue(HALO_OPACITY[0]))
  const opacity = Number.isFinite(parsed) ? parsed : HALO_OPACITY[1]
  return { color, opacity, text: textOn(mix(backgroundOf(el), color, opacity)) }
}

/** A colour t (0..1) of the way from a to b, mixed in RGB (fine within one hue).
 * Takes toRgb's "rgb(r, g, b)" or a "#rrggbb" fallback. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [a, b].map(channels)
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * Math.min(1, Math.max(0, t))))
  return `rgb(${c.join(', ')})`
}

/** The first opaque background colour from `el` up ("rgb(r, g, b)"); white if none. */
export function backgroundOf(el: HTMLElement): string {
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    const bg = getComputedStyle(e).backgroundColor
    if (bg === 'transparent' || /^rgba\(.*,\s*0\)$/.test(bg)) continue
    const rgb = toRgb(bg)
    if (rgb) return rgb
  }
  return 'rgb(255, 255, 255)'
}

/** Black or white text, whichever reads on `background` (toRgb's or a "#rrggbb" colour). */
export function textOn(background: string): string {
  const [r, g, b] = channels(background)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0a0a0a' : '#fafafa'
}

function channels(color: string): number[] {
  const rgb = /rgb\((\d+), (\d+), (\d+)\)/.exec(color)
  if (rgb) return rgb.slice(1).map(Number)
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color)
  return hex ? hex.slice(1).map((h) => parseInt(h, 16)) : [0, 0, 0]
}

let ctx: CanvasRenderingContext2D | null | undefined

/** Any CSS colour → "rgb(r, g, b)", or null if the browser doesn't understand it. */
export function toRgb(value: string): string | null {
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const sentinel = '#010203'
  ctx.fillStyle = sentinel
  ctx.fillStyle = value // ignored if invalid
  if (ctx.fillStyle === sentinel && value.toLowerCase() !== sentinel) return null
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}
