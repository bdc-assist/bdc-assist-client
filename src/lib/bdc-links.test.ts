import { describe, expect, it } from 'vitest'

import { BDC_LINKS, type BdcLink, matchBdcLink } from '@/lib/bdc-links'

const LINKS: BdcLink[] = [
  { name: 'PIC-SURE', type: 'tool', urls: ['https://picsure.example.org/'] },
  { name: 'Site', type: 'doc', urls: ['https://example.org/'] },
  { name: 'Docs', type: 'doc', urls: ['https://example.org/docs/', 'https://github.com/org/docs'] },
]
const name = (href: string | undefined) => matchBdcLink(href, LINKS)?.name ?? null

describe('matchBdcLink', () => {
  it('matches a base URL and anything under it', () => {
    expect(name('https://picsure.example.org/')).toBe('PIC-SURE')
    expect(name('https://picsure.example.org/login?next=1#top')).toBe('PIC-SURE')
  })

  it('picks the longest matching base', () => {
    expect(name('https://example.org/about')).toBe('Site')
    expect(name('https://example.org/docs/intro')).toBe('Docs')
  })

  it('ignores host case, "www." and a missing trailing slash', () => {
    expect(name('https://WWW.Example.org/docs')).toBe('Docs')
    expect(name('https://github.com/org/docs/page.md')).toBe('Docs')
  })

  it('matches whole path segments only', () => {
    expect(name('https://github.com/org/docs-old/page.md')).toBeNull()
    expect(name('https://example.org/docsx')).toBe('Site')
  })

  it('leaves other links, other protocols, relative and missing hrefs alone', () => {
    expect(name('https://grants.nih.gov/x')).toBeNull()
    expect(name('http://picsure.example.org/')).toBeNull()
    expect(name('/relative/path')).toBeNull()
    expect(name('mailto:help@example.org')).toBeNull()
    expect(name(undefined)).toBeNull()
  })
})

describe('the config', () => {
  it('has every entry, each with a known type and urls', () => {
    expect(BDC_LINKS.length).toBeGreaterThan(0)
    expect(BDC_LINKS.every((l) => ['tool', 'doc'].includes(l.type) && l.urls.length)).toBe(true)
  })

  it('tells tools from docs on the BDC domains', () => {
    expect(matchBdcLink('https://picsure.biodatacatalyst.nhlbi.nih.gov/login')?.type).toBe('tool')
    expect(matchBdcLink('https://gen3.biodatacatalyst.nhlbi.nih.gov/discovery')?.type).toBe('tool')
    // Dug's page is under the website: its longer base wins
    expect(matchBdcLink('https://biodatacatalyst.nhlbi.nih.gov/use-bdc/explore-data/dug/')?.name).toBe('Dug')
    expect(matchBdcLink('https://biodatacatalyst.nhlbi.nih.gov/use-bdc/explore-data/')?.type).toBe('doc')
    expect(matchBdcLink('https://biodatacatalyst.nhlbi.nih.gov/resources/data')?.type).toBe('doc')
    expect(matchBdcLink('https://bdcatalyst.gitbook.io/biodata-catalyst-documentation/x')?.type).toBe('doc')
    expect(matchBdcLink('https://bdcatalyst.freshdesk.com/support/home')).toBeNull()
  })
})
