/**
 * Run `fn` with Math.random replaced by a seeded generator (mulberry32), so a layout
 * that draws on it (fcose's spectral start, its tie-breaking) gives the same result
 * every time. `fn` must be synchronous: Math.random is restored as soon as it returns.
 */
export function withSeed<T>(seed: number, fn: () => T): T {
  const original = Math.random
  let s = seed >>> 0
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  try {
    return fn()
  } finally {
    Math.random = original
  }
}
