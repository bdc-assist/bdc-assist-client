import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { KG_CSS, type KgNode } from '@/kg'

import { TYPE_LABELS, type ViewMode } from './shared'

// Swatches drawn like the nodes: same colours (KG_CSS), same shapes; the
// tooltip says what each is
const LEGEND: { type: KgNode['type']; shape: string; background: string; border?: string; tip: string }[] = [
  {
    type: 'concept',
    shape: 'size-3 rounded-full',
    background: KG_CSS.concept,
    tip: 'A Dug concept from an ontology',
  },
  {
    type: 'term', // tinted, with a border
    shape: 'size-3 rounded-full border-2',
    background: KG_CSS.term,
    border: KG_CSS.concept,
    tip: 'A word searched for; not matched to a concept',
  },
  {
    type: 'variable', // the colour ramp
    shape: 'h-2.5 w-5 rounded-full',
    background: `linear-gradient(to right, ${KG_CSS.variableLow}, ${KG_CSS.variableHigh})`,
    tip: 'One study variable; the stronger the blue, the more concepts it links to',
  },
  {
    type: 'study',
    shape: 'size-2.5 rounded-[2px]',
    background: KG_CSS.study,
    tip: 'A dbGaP study; its variables link it to concepts',
  },
]

// Flow and node-link bundles draw variables as bands, not nodes: flat mid-blue, solid
// as node-link draws them; Flow's are translucent (FLOW_BAND)
const BAND: { shape: string; background: string; border?: string; tip: string } = {
  shape: 'h-1.5 w-5 rounded-sm',
  background: KG_CSS.band,
  tip: 'The variables linking a concept and a study; its width shows how many',
}
const FLOW_BAND = { ...BAND, background: KG_CSS.flowBand }

// only what the graph has (its node types, seeds, shared nodes), drawn as the view
// draws it. Inter-concept links aren't listed: hovering one names it.
type LegendProps = {
  types: ReadonlySet<KgNode['type']>
  seeds: boolean
  shared: boolean
  mode: ViewMode
  bundled: boolean // the graph draws bundles, not variables
}

// a legend entry: what it looks like and its name; the tooltip explains it
function LegendItem({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li className="flex cursor-default items-center gap-1.5">{children}</li>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tip}</TooltipContent>
    </Tooltip>
  )
}

export function Legend({ types, seeds, shared, mode, bundled }: LegendProps) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {LEGEND.filter((l) => types.has(l.type)).map((l) => {
        const bands = l.type === 'variable' && (mode === 'flow' || bundled)
        const { shape, background, border, tip } = bands ? (mode === 'flow' ? FLOW_BAND : BAND) : l
        return (
          <LegendItem key={l.type} tip={tip}>
            <span className={shape} style={{ background, borderColor: border }} />
            {bands ? 'Variables' : TYPE_LABELS[l.type]}
          </LegendItem>
        )
      })}
      {seeds && (
        // highlighted, like a seed's label in the graph; the shared halo is the same colour
        <LegendItem
          tip={
            shared
              ? 'What the question asked about; a smaller halo indicates a shared concept that links two or more of them'
              : 'What the question asked about'
          }
        >
          <span className="text-foreground rounded-sm px-1 font-bold" style={{ background: KG_CSS.halo }}>
            Queried
          </span>
        </LegendItem>
      )}
    </ul>
  )
}
