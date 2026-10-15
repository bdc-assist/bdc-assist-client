import { KG_VIEWS, type KgViewName } from '@/kg'

import type { GraphBodyProps } from './graph-body'

const VIEW_LABELS: Record<KgViewName, string> = {
  radial: 'Radial',
  force: 'Force',
  flow: 'Flow',
  list: 'List',
}

/** One dropdown for the graph's layouts, the flow (Sankey) and the list: a layout is a
 * mountGraph option, flow is mountFlow, the list is this wrapper's own, but to the
 * user they're all ways to view it. */
export function ViewPicker({ choice, available, onChoice }: Pick<GraphBodyProps, 'choice' | 'available' | 'onChoice'>) {
  return (
    <label className="flex items-center gap-1.5">
      View
      <select
        value={choice}
        onChange={(e) => onChoice(e.target.value as KgViewName)}
        className="bg-background text-foreground rounded-md border px-1 py-0.5"
      >
        {/* one the graph can't show stays listed, greyed out; why is its native tooltip
            (shown by some browsers only: an <option> can't hold a styled one) */}
        {KG_VIEWS.map((v) => (
          <option key={v} value={v} disabled={available[v] !== true} title={available[v] === true ? undefined : available[v]}>
            {VIEW_LABELS[v]}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Which graph to show: all of the answer's graphs merged, or one tool call's on its
 * own (by its label, in the user's terms). Only offered with more than one. */
export function SourcePicker({ sources, source, onSource }: { sources: string[]; source: number; onSource: (i: number) => void }) {
  return (
    <label className="flex min-w-0 items-center gap-1.5">
      Show
      <select
        value={source}
        onChange={(e) => onSource(Number(e.target.value))}
        className="bg-background text-foreground max-w-56 truncate rounded-md border px-1 py-0.5"
      >
        <option value={-1}>All results</option>
        {sources.map((label, i) => (
          <option key={i} value={i}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
