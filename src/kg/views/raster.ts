import type { KgImage } from './view'

/** Images are drawn at this many pixels per CSS pixel, so they stay sharp on high-DPI
 * screens and when a mail client scales them. */
export const IMAGE_SCALE = 2

const MARGIN = 12 // CSS pixels of `background` around the drawing

/**
 * Draw the image at `url` onto `background`, with a margin, as a PNG at IMAGE_SCALE. `size`:
 * how big to draw it, in CSS pixels; without one, the image's own size / IMAGE_SCALE (for an
 * image already drawn at that scale, e.g. Cytoscape's).
 */
export async function rasterize(url: string, background: string, size?: { width: number; height: number }): Promise<KgImage> {
  const img = new Image()
  img.src = url
  await img.decode()
  const width = size?.width ?? img.naturalWidth / IMAGE_SCALE
  const height = size?.height ?? img.naturalHeight / IMAGE_SCALE
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((width + 2 * MARGIN) * IMAGE_SCALE)
  canvas.height = Math.round((height + 2 * MARGIN) * IMAGE_SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2D canvas')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, MARGIN * IMAGE_SCALE, MARGIN * IMAGE_SCALE, width * IMAGE_SCALE, height * IMAGE_SCALE)
  return { src: canvas.toDataURL('image/png'), width: width + 2 * MARGIN, height: height + 2 * MARGIN }
}
