import type { KgNode } from '@/kg'

import { HALO, sharedHalo } from './shared'

// a node's name; a seed's (what was asked about) is highlighted and bold, as in the legend
export function NodeLabel({ node, className = '' }: { node: KgNode; className?: string }) {
  if (!node.seed) return <span className={className}>{node.label}</span>
  // bold replaces any other weight, rather than competing with it
  const rest = className.replace(/\bfont-(medium|semibold|normal)\b/, '')
  return (
    <span className={`${rest} text-foreground rounded-sm px-1 font-bold`} style={{ background: HALO }}>
      {node.label}
    </span>
  )
}

// a concept's swatch in the list: a dot, tinted with a border for a search term
export function ConceptMark({ concept, shared }: { concept: KgNode; shared: boolean }) {
  const colour =
    concept.type === 'term'
      ? { border: '1.5px solid var(--kg-concept)', background: 'color-mix(in srgb, var(--kg-concept) 30%, transparent)' }
      : { background: 'var(--kg-concept)' }
  return <span className="size-2 shrink-0 self-center rounded-full" style={{ ...colour, ...sharedHalo(shared) }} />
}
