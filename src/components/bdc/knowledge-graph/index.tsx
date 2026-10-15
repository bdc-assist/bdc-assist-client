import { Maximize2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  bridges,
  drawnGraph,
  graphShape,
  type KgFocus,
  type KgGraph,
  type KgNode,
  type KgPart,
  type KgViewName,
} from '@/kg'

import { GraphBody } from './graph-body'

// The demo's wrapper around src/kg (loaded on demand: see GraphUI in message-parts.tsx):
// a collapsible panel under the answer with the graph, or the same as a list, and
// the selected node's details, plus a button to show it all in a large dialog.
// Another host would write its own wrapper around mountGraph and studyList;
// nothing in src/kg depends on this folder.
// Here: the panel and the dialog, with the state they share. graph-body.tsx: one copy
// of the views, toolbar and details; legend, pickers, details, study-list: its parts;
// marks.tsx and shared.ts: what those parts share.

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// counts what the views draw: grouped (versions and synonyms merged) or not
function summary(g: KgGraph) {
  const count = (t: KgNode['type']) => g.nodes.filter((n) => n.type === t).length
  const [concepts, terms] = [count('concept'), count('term')]
  return [
    ...(concepts || !terms ? [counted(concepts, 'concept', 'concepts')] : []),
    ...(terms ? [counted(terms, 'search term', 'search terms')] : []),
    counted(count('variable'), 'variable', 'variables'),
    counted(count('study'), 'study', 'studies'),
  ].join(' · ')
}

/** `graph`: the answer's graphs merged; `parts`: each tool call's, when there are several. */
export function KnowledgeGraph({ graph, parts }: { graph: KgGraph; parts: KgPart[] }) {
  const [maximized, setMaximized] = useState(false)
  // shared by the panel and the dialog
  const [picked, setPicked] = useState<KgViewName>('force') // the user's pick, kept across Show
  const [sharedOnlyWanted, setSharedOnly] = useState(false)
  const [grouped, setGrouped] = useState(true) // versions and synonyms merged, as the views do by default
  const [variables, setVariables] = useState(false) // each variable, not bundles, as mountGraph does by default
  const [source, setSource] = useState(-1) // which graph: -1 all merged, else parts[source]
  const current = (source >= 0 && parts[source]?.graph) || graph
  // the message is re-rendered on every stream event, and done delivers the same
  // graph again as a new object: redraw only when the content changes. A new
  // source is a new graph too, so the views start over (and the focus clears).
  const json = JSON.stringify(current)
  const raw = useMemo(() => JSON.parse(json) as KgGraph, [json])
  // Force's positions, shared by the panel and the dialog so maximizing keeps the layout;
  // a new graph starts afresh (React redoes the render before showing it). State, not
  // useMemo: React may drop a memo (it does on every hot reload), and the panel would
  // keep the old Map while the dialog got a new one
  const [positions, setPositions] = useState(() => ({ json, map: new Map<string, { x: number; y: number }>() }))
  if (positions.json !== json) setPositions({ json, map: new Map() })
  const forcePositions = positions.map
  // what's picked (a node or a concept × study pair), in both: maximizing keeps it.
  // For this graph only: another starts with nothing picked
  const [picks, setPicks] = useState<{ json: string; focus: KgFocus | null }>({ json, focus: null })
  const focus = picks.json === json ? picks.focus : null
  const onFocus = (f: KgFocus | null) => setPicks({ json, focus: f })
  const all = useMemo(() => drawnGraph(raw), [raw]) // versions and synonyms merged
  const merged = grouped ? all : raw
  // what this graph can show, worked out before Shared only so the filter never changes
  // it; the pick where it's available (so it comes back on switching Show back), else Force
  const views = useMemo(() => graphShape(merged), [merged])
  const choice = views.available[picked] === true ? picked : views.default
  // offered only when it changes something
  const canGroup = all.nodes.length !== raw.nodes.length
  const sharedStudies = useMemo(() => {
    const ids = bridges(merged)
    return merged.nodes.filter((n) => n.type === 'study' && ids.has(n.id)).length
  }, [merged])
  // a single call's graph may share nothing: then the filter is off (and not offered)
  const sharedOnly = sharedOnlyWanted && sharedStudies > 0
  // what the list and the details see: what the views draw, with the options they get
  const shown = useMemo(
    () => drawnGraph(raw, { collapseVersions: grouped, groupSynonyms: grouped, sharedOnly }),
    [raw, grouped, sharedOnly],
  )
  // what was asked about, in this graph (all results, or the one call shown)
  const asked = merged.nodes.filter((n) => n.seed).map((n) => n.label)
  const title = (
    <>
      <span className="text-foreground font-medium">
        Knowledge graph{asked.length > 0 && `: ${asked.join(', ')}`}
      </span>{' '}
      · {summary(merged)}
      {sharedStudies > 0 && ` · ${sharedStudies} shared`}
    </>
  )
  const filter = {
    grouped,
    onGrouped: setGrouped,
    canGroup,
    variables,
    onVariables: setVariables,
    sharedOnly,
    onSharedOnly: setSharedOnly,
    canShare: sharedStudies > 0,
    sources: parts.map((p) => p.label),
    source,
    onSource: setSource,
    focus,
    onFocus,
  }

  return (
    <>
      <details open className="my-3 rounded-lg border text-xs">
        <summary className="text-muted-foreground flex cursor-pointer items-center gap-2 px-3 py-1.5 select-none">
          <span className="flex-1">{title}</span>
          <TooltipIconButton
            tooltip="Maximize"
            side="left"
            className="size-7 p-1.5"
            onClick={(e) => {
              e.preventDefault() // a click in <summary> would also fold the panel
              setMaximized(true)
            }}
          >
            <Maximize2Icon />
          </TooltipIconButton>
        </summary>
        <GraphBody
          json={json}
          shown={shown}
          canvasClass="h-72"
          choice={choice}
          onChoice={setPicked}
          available={views.available}
          {...filter}
          forcePositions={forcePositions}
          covered={maximized}
          zoomGestures="modifier"
        />
      </details>
      <Dialog open={maximized} onOpenChange={setMaximized}>
        <DialogContent
          aria-describedby={undefined}
          className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none"
        >
          <DialogTitle className="text-muted-foreground px-3 py-2.5 pr-12 text-xs font-normal">{title}</DialogTitle>
          {maximized && (
            <GraphBody
              json={json}
              shown={shown}
              canvasClass="min-h-0 flex-1"
              choice={choice}
              onChoice={setPicked}
              available={views.available}
              {...filter}
              forcePositions={forcePositions}
              zoomGestures
              detailsBeside
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
