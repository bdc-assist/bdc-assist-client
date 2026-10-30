import type { KgGraph } from '../model/types'
import { mountFlow } from './flow'
import { mountGraph, type GraphOptions } from './graph'
import type { KgImage, KgLayout } from './view'

export type RenderImageOptions = Omit<GraphOptions, 'layout' | 'onFocus' | 'onZoomHint' | 'zoomGestures'> & {
  /** The box it's laid out in, in CSS pixels (default 800 × 500). The image is the
   * drawing's own size: for Radial and Force about this box, for Flow exactly it. */
  width?: number
  height?: number
  /** Default white. */
  background?: string
}

/**
 * `graph` drawn as `view` into a container of its own, off screen, then as a PNG (see
 * KgView.image): for a graph that isn't on screen, or to draw it in other colours than the
 * page's. Colours: the --kg-* custom properties set on document.body or above, else
 * src/kg's defaults (light, for a white background). Force lays out as it would on
 * screen; pass the on-screen view's `forcePositions` (a copy: Force writes into it) to
 * keep its layout, drags included.
 */
export async function renderImage(graph: KgGraph, view: KgLayout | 'flow', options: RenderImageOptions = {}): Promise<KgImage> {
  const { width = 800, height = 500, background = '#ffffff', ...drawing } = options
  const container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    background,
  })
  document.body.append(container)
  const shown = view === 'flow' ? mountFlow(container, graph, drawing) : mountGraph(container, graph, { ...drawing, layout: view })
  try {
    return await shown.image({ background })
  } finally {
    shown.destroy()
    container.remove()
  }
}
