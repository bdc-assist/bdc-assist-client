import { WrenchIcon } from 'lucide-react'
import type { ComponentPropsWithoutRef } from 'react'

import { matchBdcLink } from '@/lib/bdc-links'
import { cn } from '@/lib/utils'

// A link in answer text. Links into BDC (src/config/bdc-links.json) get their own look: docs in
// the BDC red, tools also on its tint with a wrench after. No external-link icon here: in running
// text a link reads as a link; the icon stays on links in the app's own UI (sources, graph details).
// Every link opens in a new tab, so following one doesn't leave the chat.
export function MarkdownLink({ className, href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
  const type = matchBdcLink(href)?.type
  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'aui-md-a underline-offset-2 hover:opacity-80',
        type === 'tool'
          ? 'rounded bg-(--bdc-link-bg) px-1 py-px text-(--bdc-link) no-underline box-decoration-clone'
          : type === 'doc'
            ? 'text-(--bdc-link) underline decoration-(--bdc-link)'
            : 'text-primary decoration-muted-foreground underline',
        className,
      )}
    >
      {children}
      {type === 'tool' && <WrenchIcon aria-hidden className="ml-0.5 inline size-3 align-[-1px]" />}
    </a>
  )
}
