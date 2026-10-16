import { describe, expect, it } from 'vitest'

import { KG_CSS, mix, textOn } from './marks'

describe('KG_CSS', () => {
  it('follows the --kg-* properties, with the defaults as fallbacks', () => {
    expect(KG_CSS.concept).toBe('var(--kg-concept, #d97706)')
    expect(KG_CSS.term).toBe('color-mix(in srgb, var(--kg-concept, #d97706) 30%, transparent)')
  })

  it('runs variables along the ramp by weight; bands are its middle', () => {
    expect(KG_CSS.variable(0.25)).toBe(
      'color-mix(in srgb, var(--kg-variable-high, #1e40af) 25%, var(--kg-variable-low, #93c5fd))',
    )
    expect(KG_CSS.band).toBe(KG_CSS.variable(0.5))
    expect(KG_CSS.flowBand).toBe(`color-mix(in srgb, ${KG_CSS.band} 45%, transparent)`)
  })
})

describe('mix and textOn', () => {
  it('mixes in RGB, clamped to 0..1', () => {
    expect(mix('#000000', 'rgb(200, 100, 50)', 0.5)).toBe('rgb(100, 50, 25)')
    expect(mix('#000000', '#ffffff', 2)).toBe('rgb(255, 255, 255)')
  })

  it('picks black text on light colours, white on dark', () => {
    expect(textOn('#fde047')).toBe('#0a0a0a')
    expect(textOn('rgb(30, 64, 175)')).toBe('#fafafa')
  })
})
