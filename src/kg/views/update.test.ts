// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountFlow } from './flow'
import { mountGraph } from './graph'
import { ASTHMA, CHD, TWO } from '../test-fixtures'

// update(): a view given another graph draws it, and starts over: no focus (the host is
// told), and in Force a fresh layout. Both views, mounted in happy-dom.

const HEART = 'MONDO:0005453' // congenital heart disease: CHD's seed, not in TWO

// happy-dom has no canvas, which Cytoscape draws on (and toRgb reads colours through):
// a 2D context that accepts everything and draws nothing
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  const canvas = this
  const noop = () => {}
  return new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, k) =>
      k in t
        ? t[k]
        : k === 'canvas'
          ? canvas
          : k === 'getImageData'
            ? () => ({ data: new Uint8ClampedArray(4) })
            : k === 'measureText'
              ? () => ({ width: 0 })
              : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern'
                ? () => ({ addColorStop: noop })
                : k === 'getTransform'
                  ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
                  : noop,
    set: (t, k, v) => ((t[k] = v), true),
  })
} as never

// a container with a size, as the views need (happy-dom doesn't lay out)
function container(): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: 800 })
  Object.defineProperty(el, 'clientHeight', { value: 400 })
  el.style.padding = '0px' // Cytoscape subtracts it from the size; unset, it reads NaN
  document.body.append(el)
  return el
}

afterEach(() => document.body.replaceChildren())

describe('mountFlow: update()', () => {
  it('draws the new graph', () => {
    const el = container()
    const view = mountFlow(el, CHD)
    const drawn = () => [...el.querySelectorAll<SVGElement>('[data-id]')].map((e) => e.dataset.id)
    expect(drawn()).toContain(HEART)
    view.update(TWO)
    expect(drawn()).toContain(ASTHMA)
    expect(drawn()).not.toContain(HEART)
  })

  it('drops the focus, and tells the host', () => {
    const onFocus = vi.fn()
    const view = mountFlow(container(), CHD, { onFocus })
    view.focus({ node: HEART })
    view.update(TWO)
    expect(onFocus).toHaveBeenLastCalledWith(null)
  })

  it('takes new options along with the graph', () => {
    const el = container()
    const view = mountFlow(el, CHD)
    view.update(TWO, { sharedOnly: true })
    const studies = el.querySelectorAll('.kg-flow-nodes [data-id^="phs"]').length
    view.update(TWO, { sharedOnly: false })
    expect(el.querySelectorAll('.kg-flow-nodes [data-id^="phs"]').length).toBeGreaterThan(studies)
  })
})

describe('mountGraph: update()', () => {
  it('drops the focus, and tells the host', () => {
    const onFocus = vi.fn()
    const view = mountGraph(container(), CHD, { onFocus })
    view.focus({ node: HEART })
    view.update(TWO)
    expect(onFocus).toHaveBeenLastCalledWith(null)
  })

  it('lays the new graph out afresh in Force, in a new positions Map', () => {
    const before = new Map<string, { x: number; y: number }>()
    const view = mountGraph(container(), CHD, { layout: 'force', forcePositions: before })
    expect(before.has(HEART)).toBe(true)
    const after = new Map<string, { x: number; y: number }>()
    view.update(TWO, { forcePositions: after })
    expect(after.has(ASTHMA)).toBe(true)
    expect(after.has(HEART)).toBe(false)
    expect(before.has(ASTHMA)).toBe(false) // the old graph's Map is left alone
  })
})
