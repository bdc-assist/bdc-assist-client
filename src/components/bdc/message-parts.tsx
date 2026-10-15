import { makeAssistantDataUI, useAui, useAuiState } from '@assistant-ui/react'
import { lazy, Suspense, useState } from 'react'
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CircleHelpIcon,
  CirclePlayIcon,
  ChevronDownIcon,
  CornerDownRightIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GlobeIcon,
  LoaderCircleIcon,
  NewspaperIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react'

import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import type { KgGraph } from '@/kg/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import {
  BLOCKED_PART,
  DRAFT_PART,
  FOLLOWUPS_PART,
  GRAPH_PART,
  type GraphPartData,
  REJECTED_PART,
  SOURCES_PART,
  UNAVAILABLE_PART,
  STATUS_PART,
  type DraftPartData,
  type Source,
  type Sources,
  type StatusPartData,
} from '@/lib/bdc-adapter'

// Renderers for the `data` parts bdc-adapter appends after the answer text.
// Each makeAssistantDataUI component registers its renderer while mounted.

const NODE_LABELS: Record<string, string> = {
  input_guardrail: 'Screening the question…',
  contextualize: 'Reading the conversation…',
  classify: 'Checking known topics…',
  agent: 'Thinking…',
  output_guardrail: 'Reviewing the answer…',
  output_reject: 'Answer rejected…',
  append_disclaimer: 'Adding disclaimers…',
  suggest_followups: 'Suggesting follow-ups…',
}

const toolLabel = (status: string) =>
  status.replace(/^calling (\w+)$/, (_, tool: string) => `Using ${tool.replace(/_/g, ' ')}…`)

// The last snapshot of a stopped or failed answer still holds its progress
// parts; draw them only while the answer is running, so no spinner is left behind.
const useRunning = () => useAuiState((s) => s.message.status?.type === 'running')

const StatusUI = makeAssistantDataUI<StatusPartData>({
  name: STATUS_PART,
  render: function StatusLine({ data: { node, status } }) {
    if (!useRunning()) return null
    return (
      <p data-slot="bdc-status" className="text-muted-foreground my-2 flex items-center gap-1.5 text-sm">
        <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />
        {status ? toolLabel(status) : (NODE_LABELS[node!] ?? `${node}…`)}
      </p>
    )
  },
})

// doc_type values come from bdc-doc-mcp's ingest (SOURCE_DOC_TYPES); dbgap-study from
// Dug (the studies behind a graph). `many`: the popover title for several.
type SourceType = { label: string; many: string; Icon: LucideIcon }
const SOURCE_TYPES: Record<string, SourceType> = {
  page: { label: 'BDC website', many: 'BDC website pages', Icon: GlobeIcon },
  docs: { label: 'Documentation', many: 'Documentation', Icon: BookOpenIcon },
  faq: { label: 'FAQ', many: 'FAQs', Icon: CircleHelpIcon },
  video: { label: 'Video', many: 'Videos', Icon: CirclePlayIcon },
  event: { label: 'Event', many: 'Events', Icon: CalendarDaysIcon },
  update: { label: 'Update', many: 'Updates', Icon: NewspaperIcon },
  fellow: { label: 'Fellow', many: 'Fellows', Icon: UserRoundIcon },
  'dbgap-study': { label: 'dbGaP study', many: 'dbGaP studies', Icon: DatabaseIcon },
}
const OTHER_SOURCE: SourceType = { label: 'Source', many: 'Sources', Icon: FileTextIcon }

const iconClass =
  'text-muted-foreground hover:text-foreground hover:bg-muted flex items-center rounded-md transition-colors'

/** One source: its type's icon, linking to it, with its title as the tooltip. */
function SourceLink({ source, type }: { source: Source; type: SourceType }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={source.link}
          target="_blank"
          rel="noreferrer"
          aria-label={`${source.title} (${type.label})`}
          className={`${iconClass} size-6 justify-center p-1`}
        >
          <type.Icon className="size-4" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex-col items-start gap-0">
        <span className="font-medium">{source.title}</span>
        <span className="opacity-70">{type.label}</span>
      </TooltipContent>
    </Tooltip>
  )
}

type SourceGroupProps = { sources: Source[]; type: SourceType; open: boolean; onOpenChange: (open: boolean) => void }

/** Several sources of one type (e.g. the 10–20 studies Dug cites behind a graph): one
 * icon with the count, opening a list of them on click (a popover: the list holds
 * links, which a tooltip shouldn't), instead of a row of identical icons. The chevron
 * says it opens. */
function SourceGroup({ sources, type, open, onOpenChange }: SourceGroupProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${type.many} (${sources.length})`}
          className={`${iconClass} data-[state=open]:bg-muted data-[state=open]:text-foreground h-6 gap-0.5 px-1 text-xs`}
        >
          <type.Icon className="size-4" />
          {sources.length}
          <ChevronDownIcon className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-3 py-2">
          <PopoverTitle className="text-sm">
            {type.many} ({sources.length})
          </PopoverTitle>
        </PopoverHeader>
        <ul className="max-h-72 overflow-y-auto p-1 text-sm">
          {sources.map((s) => (
            <li key={s.link}>
              <a
                href={s.link}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-muted flex items-start gap-2 rounded-md px-2 py-1.5"
              >
                <span className="flex-1">{s.title}</span>
                <ExternalLinkIcon className="text-muted-foreground mt-1 size-3 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// Right-aligned on the line of the message's copy/refresh toolbar. That
// toolbar is vendored (thread.aui.tsx AssistantMessage), so rather than edit
// it, this row copies its box: the message root is `relative pb-7.5`, and the
// footer above that padding is `min-h-7.5 pt-1.5` with 24px (size-6) buttons.
// It must stay inside the root's box: the root uses content-visibility, which
// clips anything painted outside it.
// Shown and hidden with the toolbar it sits beside, by the same rules as its
// ActionBarPrimitive.Root (hideWhenRunning, autohide="not-last").
const useToolbarVisible = () =>
  useAuiState((s) => !s.thread.isRunning && (s.message.isLast || s.message.isHovering))

// Sources by type, each type where its first source is: one of a type is its own
// icon, two or more share one (SourceGroup).
const SourcesUI = makeAssistantDataUI<Sources>({
  name: SOURCES_PART,
  render: function SourcesRow({ data }) {
    const visible = useToolbarVisible()
    // a group's popover renders outside the message, so moving the pointer into it
    // ends the message's hover: keep the row (and the popover) while one is open
    const [openType, setOpenType] = useState<string | null>(null)
    if (!visible && openType === null) return null
    const byType = new Map<string, Source[]>()
    for (const s of Object.values(data as Sources).flat()) byType.set(s.type, [...(byType.get(s.type) ?? []), s])
    return (
      <ul
        data-slot="bdc-sources"
        aria-label="Sources"
        className="absolute right-2 bottom-7.5 flex min-h-7.5 items-center gap-1 pt-1.5"
      >
        {[...byType].map(([key, sources]) => {
          const type = SOURCE_TYPES[key] ?? OTHER_SOURCE
          return sources.length === 1 ? (
            <li key={key}>
              <SourceLink source={sources[0]} type={type} />
            </li>
          ) : (
            <li key={key}>
              <SourceGroup
                sources={sources}
                type={type}
                open={openType === key}
                onOpenChange={(open) => setOpenType(open ? key : null)}
              />
            </li>
          )
        })}
      </ul>
    )
  },
})

const BlockedUI = makeAssistantDataUI({
  name: BLOCKED_PART,
  render: () => (
    <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
      <ShieldAlertIcon className="size-3.5" />
      Outside what BDC Assist can help with
    </p>
  ),
})

const WORDS_PER_BAR = 12
const MAX_BARS = 10

const DraftUI = makeAssistantDataUI<DraftPartData>({
  name: DRAFT_PART,
  render: function DraftBars({ data: { words } }) {
    if (!useRunning()) return null
    const bars = Math.min(MAX_BARS, Math.ceil(words / WORDS_PER_BAR))
    return (
      <div className="my-1 flex flex-col gap-2" aria-label="Writing the answer">
        {Array.from({ length: bars }, (_, i) => (
          <Skeleton key={i} className={i === bars - 1 ? 'h-4 w-3/5' : 'h-4 w-full'} />
        ))}
      </div>
    )
  },
})

const RejectedUI = makeAssistantDataUI({
  name: REJECTED_PART,
  render: () => (
    <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
      <RotateCcwIcon className="size-3.5" />
      Replaces a first draft that didn't answer the question
    </p>
  ),
})

// Under the last answer, in the message itself rather than the sticky footer
// above the composer, so they scroll away with the answer instead of taking
// room from the chat. Only the last answer's are offered, and not while a new
// one runs; clicking one sends it. Not ThreadPrimitive.Suggestion: inside a
// message its `composer` is the message's edit composer, and clearing that after
// sending throws ("Composer is not available"). Appending to the thread directly
// also leaves whatever the user has typed in the composer alone.
const FollowupsUI = makeAssistantDataUI<string[]>({
  name: FOLLOWUPS_PART,
  render: function Followups({ data }: { data: string[] }) {
    const aui = useAui()
    const offered = useAuiState((s) => s.message.isLast && !s.thread.isRunning)
    if (!offered) return null
    return (
      <ul data-slot="bdc-followups" aria-label="Suggested follow-ups" className="mt-3 flex flex-col items-start gap-0.5">
        {data.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => aui.thread().append({ content: [{ type: 'text', text: prompt }] })}
              className="text-muted-foreground hover:text-foreground hover:bg-muted -mx-1.5 flex items-baseline gap-1.5 rounded-md px-1.5 py-0.5 text-start text-sm transition-colors"
            >
              <CornerDownRightIcon className="size-3.5 shrink-0 self-center" />
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    )
  },
})

// The graph panel, and with it Cytoscape (~430 kB), loads the first time an answer
// has a graph, not with the page; a placeholder the panel's height stands in.
const KnowledgeGraph = lazy(() => import('@/components/bdc/knowledge-graph').then((m) => ({ default: m.KnowledgeGraph })))

const GraphUI = makeAssistantDataUI<GraphPartData | KgGraph>({
  name: GRAPH_PART,
  render: ({ data }) => {
    // conversations saved before per-call graphs stored just the graph
    const { graph, parts } = 'nodes' in data ? { graph: data, parts: [] } : data
    return (
      <Suspense fallback={<Skeleton className="my-3 h-[23rem] w-full rounded-lg" aria-label="Loading the knowledge graph" />}>
        <KnowledgeGraph graph={graph} parts={parts} />
      </Suspense>
    )
  },
})

// Some MCP servers (e.g. the knowledge graph) were down: the answer had to do without
// them. The server names are for whoever runs it, so they're only in the tooltip.
const UnavailableUI = makeAssistantDataUI<string[]>({
  name: UNAVAILABLE_PART,
  render: ({ data }: { data: string[] }) => (
    <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs" title={`Unavailable: ${data.join(', ')}`}>
      <TriangleAlertIcon className="size-3.5" />
      Some data services are unavailable right now, so this answer may be incomplete
    </p>
  ),
})

/** Mount once inside the runtime provider. */
export function BdcMessageParts() {
  return (
    <>
      <StatusUI />
      <SourcesUI />
      <BlockedUI />
      <DraftUI />
      <RejectedUI />
      <UnavailableUI />
      <GraphUI />
      <FollowupsUI />
    </>
  )
}
