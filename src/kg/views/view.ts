import type { DrawOptions } from '../model/drawn'
import type { KgFocus } from '../model/focus'
import { shapeOf } from '../model/shape'
import type { KgGraph } from '../model/types'

/**
 * mountGraph's layouts:
 * - radial: the seeds (what was asked about) in the middle, or without seeds the concepts;
 *   their variables around them, studies outside. Separate pieces (e.g. from unrelated
 *   calls) each get their own centre, side by side (see arrangeRadial in radial.ts)
 * - force: a force-directed layout (d3-force); clusters form on their own. Separate
 *   pieces are packed side by side (see arrangeForce in force.ts)
 */
export const KG_LAYOUTS = ['radial', 'force'] as const
export type KgLayout = (typeof KG_LAYOUTS)[number]

/** Every view of a graph: mountGraph's layouts, the flow (mountFlow) and the list
 * (studyList), in the order a picker lists them: Force first. */
export const KG_VIEWS = ['force', 'radial', 'flow', 'list'] as const
export type KgViewName = KgLayout | 'flow' | 'list'

/** A view that's one of mountGraph's layouts (rather than Flow or a list). */
export const isLayout = (view: KgViewName): view is KgLayout => (KG_LAYOUTS as readonly string[]).includes(view)

/** Every view, and whether it can show a graph: `true`, or why not (for a tooltip);
 * and the one to start with. */
export type KgViewChoices = { views: Record<KgViewName, true | string>; default: KgViewName }

/**
 * Which views suit `graph`, from what it contains (shapeOf): Radial needs a seed to
 * centre on, Flow studies; Force and List always work. The default is Force, for every
 * shape so far. Work it out before "Shared only", so the filter never changes which
 * views are offered.
 */
export function viewChoices(graph: KgGraph): KgViewChoices {
  const shape = shapeOf(graph)
  return {
    views: {
      radial: shape.seeds > 0 || 'Needs a concept that was asked about',
      force: true,
      flow: shape.studies || 'Needs studies',
      list: true,
    },
    default: 'force',
  }
}

/** Options every view of a graph takes (mountGraph, mountFlow): how it's drawn (see
 * drawnGraph), plus: */
export type KgViewOptions = DrawOptions & {
  /** The user picked something (a node, or a concept × study pair; null: the
   * background). The host decides what to show, and tells other views (focus). Also
   * called when a redraw (setOptions) moves the focus or drops it (see carryFocus). */
  onFocus?: (focus: KgFocus | null) => void
}

/** What every view of a graph can do, so a host can switch views without caring
 * which one is showing. Ids are as drawn (collapsed or not). */
export type KgView<O extends KgViewOptions = KgViewOptions> = {
  /** Draw another graph, or the same with changed options. */
  update(graph: KgGraph, options?: Partial<O>): void
  /** Change options for the current graph. */
  setOptions(options: Partial<O>): void
  /** Show a focus picked elsewhere (another view, a list): highlight what it
   * connects (see focusConnections), fade the rest; null clears. Doesn't call onFocus. */
  focus(focus: KgFocus | null): void
  /** Call after the container changed size (e.g. was hidden, then shown). */
  resize(): void
  /** Re-read the --kg-* colours (e.g. after a theme change). */
  refreshStyle(): void
  /** The whole drawing (not just what's scrolled or zoomed into view), as a PNG on
   * `background` (default white) with a margin, drawn at 2x for sharpness. To draw a graph
   * that isn't on screen, see renderImage. */
  image(options?: { background?: string }): Promise<KgImage>
  destroy(): void
}

/** A view drawn as a picture: `src` a data: URL of a PNG; width and height in CSS pixels
 * (the PNG itself has twice as many). */
export type KgImage = { src: string; width: number; height: number }
