import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SourceGroup } from '@/components/bdc/message-parts'
import { OTHER_SOURCE, SOURCE_TYPES, sourcesByType } from '@/components/bdc/source-types'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Source } from '@/lib/bdc-adapter'

const src = (type: string, n = 1): Source => ({ title: `${type} ${n}`, link: `https://x/${type}/${n}`, type })

describe('sourcesByType', () => {
  it('keeps the server order, then publications, then dbGaP studies last', () => {
    const order = sourcesByType({
      dug: [src('dbgap-study')],
      artie: [src('publication')],
      'bdc-doc': [src('faq'), src('docs'), src('faq', 2)],
      predefined: [src('predefined')],
    }).map((t) => t.key)
    expect(order).toEqual(['faq', 'docs', 'predefined', 'publication', 'dbgap-study'])
  })

  it('groups by type, not by the key the server listed them under', () => {
    const [faq] = sourcesByType({ a: [src('faq')], b: [src('faq', 2)] })
    expect(faq.sources.map((s) => s.title)).toEqual(['faq 1', 'faq 2'])
    expect(faq.type).toBe(SOURCE_TYPES.faq)
  })

  it('shows a type it does not know as a generic source', () => {
    expect(sourcesByType({ x: [src('preprint')] })[0].type).toBe(OTHER_SOURCE)
  })
})

describe('SourceGroup', () => {
  const render = (sources: Source[]) =>
    renderToStaticMarkup(
      <TooltipProvider>
        <SourceGroup sources={sources} type={SOURCE_TYPES.publication} open={false} onOpenChange={() => {}} />
      </TooltipProvider>,
    )

  it('opens a list even for one source, with no count', () => {
    const html = render([src('publication')])
    expect(html).toContain('aria-haspopup="dialog"') // a popover trigger, not a link
    expect(html).not.toContain('href=')
    expect(html).toContain('aria-label="Publication"')
    expect(html).not.toMatch(/<\/svg>\d/)
  })

  it('shows the count for several', () => {
    const html = render([src('publication'), src('publication', 2), src('publication', 3)])
    expect(html).toContain('aria-label="Publications (3)"')
    expect(html).toMatch(/<\/svg>3<svg/)
  })
})
