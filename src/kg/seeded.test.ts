import { describe, expect, it } from 'vitest'

import { withSeed } from './seeded'

describe('withSeed', () => {
  const draw = () => [Math.random(), Math.random(), Math.random()]

  it('gives the same numbers for the same seed, and others for another', () => {
    expect(withSeed(1, draw)).toEqual(withSeed(1, draw))
    expect(withSeed(1, draw)).not.toEqual(withSeed(2, draw))
    expect(withSeed(1, draw).every((x) => x >= 0 && x < 1)).toBe(true)
  })

  it('puts Math.random back, also after a throw', () => {
    const original = Math.random
    withSeed(1, draw)
    expect(Math.random).toBe(original)
    expect(() =>
      withSeed(1, () => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(Math.random).toBe(original)
  })
})
