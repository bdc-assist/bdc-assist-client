import type { DrawOptions } from '../model/drawn'
import type { KgFocus } from '../model/focus'
import type { KgGraph } from '../model/types'

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
  destroy(): void
}
