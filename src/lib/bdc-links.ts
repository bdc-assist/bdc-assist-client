// BDC links in answer text: the model writes ordinary markdown links (URLs from the retrieved
// docs), and the app gives the ones pointing into BDC their own look. Which URLs count is set in
// src/config/bdc-links.json, as base URLs per tool or doc site; the longest matching base wins.
import config from '@/config/bdc-links.json'

export type BdcLinkType = 'tool' | 'doc'
export type BdcLink = { name: string; type: BdcLinkType; urls: string[] }

const TYPES: readonly string[] = ['tool', 'doc'] satisfies BdcLinkType[]

/** The config's entries, minus any with an unknown type or no urls. */
export const BDC_LINKS: BdcLink[] = config.links.filter(
  (l): l is BdcLink => TYPES.includes(l.type) && l.urls.length > 0,
)

/** A URL as "protocol//host/path/" for prefix matching: host lowercased, no "www.", path ending
 * in "/" so a base only matches whole path segments; null if it isn't an absolute URL. */
function key(href: string): string | null {
  try {
    const u = new URL(href)
    const path = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`
    return `${u.protocol}//${u.hostname.toLowerCase().replace(/^www\./, '')}${path}`
  } catch {
    return null
  }
}

/** The entry whose base URL is the longest prefix of `href`, or null for any other link. */
export function matchBdcLink(href: string | undefined, links: BdcLink[] = BDC_LINKS): BdcLink | null {
  const k = href && key(href)
  if (!k) return null
  let best: BdcLink | null = null
  let bestLength = 0
  for (const link of links) {
    for (const url of link.urls) {
      const base = key(url)
      if (base && k.startsWith(base) && base.length > bestLength) {
        best = link
        bestLength = base.length
      }
    }
  }
  return best
}
