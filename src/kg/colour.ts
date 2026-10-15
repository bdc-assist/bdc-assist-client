// Colour helpers shared by the views. Colours come from --kg-* custom properties, as
// any CSS colour: Cytoscape can't parse e.g. oklch() itself, so toRgb converts
// through a canvas.

// seeds and shared nodes: a halo (and the seeds' label highlight) in a highlighter
// colour that isn't a type's, since a seed can be of any type. The opacity is a number
// in --kg-halo-opacity: pale colours need more on light backgrounds, less on dark ones
const HALO_COLOR = '#fde047'
const HALO_OPACITY = 0.45

/** The halo as `el` sees it: its colour ("rgb(r, g, b)"), opacity, and the text colour
 * (black or white) that reads on a label highlighted with it over the background. */
export function haloOf(el: HTMLElement): { color: string; opacity: number; text: string } {
  const css = getComputedStyle(el)
  const value = css.getPropertyValue('--kg-halo').trim()
  const color = (value && toRgb(value)) || HALO_COLOR
  const parsed = Number.parseFloat(css.getPropertyValue('--kg-halo-opacity'))
  const opacity = Number.isFinite(parsed) ? parsed : HALO_OPACITY
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
