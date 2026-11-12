import { Redo2Icon, Undo2Icon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import {
  ToolCard,
  ToolViewFrame,
  useToolView,
  type ToolMessage,
} from '@/components/bdc/tool-view'
import {
  bridges,
  drawnGraph,
  viewChoices,
  type KgFocus,
  type KgGraph,
  type KgNode,
  type KgPart,
  type KgViewName,
} from '@/kg'

import { setShownGraph } from '@/lib/shown-graphs'

import { demoEdit, demoSuggestion } from './demo-edits'
import { GraphBody } from './graph-body'

// The demo's wrapper around src/kg (loaded on demand: see GraphUI in message-parts.tsx):
// a card under the answer with the graph, or the same as a list, and the selected node's details,
// plus a button to show it all in the tool view beside the conversation (../tool-view/).
// Another host would write its own wrapper around mountGraph and studyList;
// nothing in src/kg depends on this folder.
// Here: the card and the tool view, with the state they share. graph-body.tsx: one copy
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
  // the large copy goes in the tool view beside the conversation
  const tool = useToolView('graph')
  // shared by the card and the tool view
  const [picked, setPicked] = useState<KgViewName>('force') // the user's pick, kept across Show
  const [sharedOnlyWanted, setSharedOnly] = useState(false)
  const [grouped, setGrouped] = useState(true) // versions and synonyms merged, as the views do by default
  const [variables, setVariables] = useState(false) // each variable, not bundles, as mountGraph does by default
  const [source, setSource] = useState(-1) // which graph: -1 all merged, else parts[source]
  // changes made in the tool view's chat. states[at] is the graph shown, null the answer's own;
  // Undo and Redo move `at`, a new change drops what was undone. Reset to original is a change too (undoable).
  // The answer shows the changed graph as well, marked. In memory only: a reload loses them
  const [edits, setEdits] = useState<{ states: (KgGraph | null)[]; at: number }>({ states: [null], at: 0 })
  const edited = edits.states[edits.at]
  const change = (next: KgGraph | null) =>
    setEdits((e) => ({ states: [...e.states.slice(0, e.at + 1), next], at: e.at + 1 }))
  const [chat, setChat] = useState<ToolMessage[]>([])
  const [busy, setBusy] = useState(false)
  const current = edited ?? ((source >= 0 && parts[source]?.graph) || graph)
  const send = async (text: string) => {
    setChat((c) => [...c, { role: 'user', text }])
    setBusy(true)
    const result = await demoEdit(text, current)
    if (result.graph !== current) change(result.graph)
    setChat((c) => [...c, { role: 'tool', text: result.reply }])
    setBusy(false)
  }
  // the message is re-rendered on every stream event, and done delivers the same
  // graph again as a new object: redraw only when the content changes, so compare it as
  // JSON, worked out only when the object changes (not on every event). A new source is
  // a new graph too, so the views start over (and the focus clears).
  const json = useMemo(() => JSON.stringify(current), [current])
  const raw = useMemo(() => JSON.parse(json) as KgGraph, [json])
  // Force's positions, shared by the card and the tool view so opening it keeps the layout;
  // a new graph starts afresh (React redoes the render before showing it). State, not
  // useMemo: React may drop a memo (it does on every hot reload), and the card would
  // keep the old Map while the tool view got a new one
  const [positions, setPositions] = useState(() => ({ json, map: new Map<string, { x: number; y: number }>() }))
  if (positions.json !== json) setPositions({ json, map: new Map() })
  const forcePositions = positions.map
  // what's picked (a node or a concept × study pair), in both: opening the tool view keeps it.
  // For this graph only: another starts with nothing picked
  const [picks, setPicks] = useState<{ json: string; focus: KgFocus | null }>({ json, focus: null })
  const focus = picks.json === json ? picks.focus : null
  const onFocus = (f: KgFocus | null) => setPicks({ json, focus: f })
  const all = useMemo(() => drawnGraph(raw), [raw]) // versions and synonyms merged
  const merged = grouped ? all : raw
  // what this graph can show, worked out before Shared only so the filter never changes
  // it; the pick where it's available (so it comes back on switching Show back), else Force
  const choices = useMemo(() => viewChoices(merged), [merged])
  const choice = choices.views[picked] === true ? picked : choices.default
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
  // for an email of the answer: draw the graph as it's shown here
  useEffect(() => {
    setShownGraph(graph, {
      graph: raw,
      view: choice,
      options: { collapseVersions: grouped, groupSynonyms: grouped, sharedOnly, variables },
      forcePositions,
    })
  }, [graph, raw, choice, grouped, sharedOnly, variables, forcePositions])
  // what was asked about, in this graph (all results, or the one call shown)
  const asked = merged.nodes.filter((n) => n.seed).map((n) => n.label)
  // the card's and the tool header's summary line
  const summaryLine = [asked.join(', '), summary(merged), ...(sharedStudies > 0 ? [`${sharedStudies} shared`] : [])]
    .filter(Boolean)
    .join(' · ')
  const filter = {
    grouped,
    onGrouped: setGrouped,
    canGroup,
    variables,
    onVariables: setVariables,
    sharedOnly,
    onSharedOnly: setSharedOnly,
    canShare: sharedStudies > 0,
    sources: edited ? [] : parts.map((p) => p.label), // a changed graph is one graph
    source,
    onSource: setSource,
    focus,
    onFocus,
  }

  // the large copy in the tool view (a portal, so where it's rendered from doesn't matter)
  const toolFrame = tool.isOpen && (
    <ToolViewFrame
      kind="graph"
      chat={{
        what: 'graph',
        messages: chat,
        suggestion: edited ? null : demoSuggestion(current),
        busy,
        onSend: (t) => void send(t),
      }}
      summary={summaryLine}
      edited={Boolean(edited)}
      onReset={() => change(null)}
      actions={
        <>
          <TooltipIconButton
            tooltip="Undo"
            side="bottom"
            className="size-7 p-1.5"
            disabled={edits.at === 0 || busy}
            onClick={() => setEdits((e) => ({ ...e, at: e.at - 1 }))}
          >
            <Undo2Icon />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Redo"
            side="bottom"
            className="size-7 p-1.5"
            disabled={edits.at === edits.states.length - 1 || busy}
            onClick={() => setEdits((e) => ({ ...e, at: e.at + 1 }))}
          >
            <Redo2Icon />
          </TooltipIconButton>
        </>
      }
    >
      <GraphBody
        raw={raw}
        shown={shown}
        canvasClass="min-h-0 flex-1"
        choice={choice}
        onChoice={setPicked}
        views={choices.views}
        {...filter}
        forcePositions={forcePositions}
        zoomGestures
        detailsStrip
      />
    </ToolViewFrame>
  )

  // the card every tool's object has (../tool-view/card.tsx), with the graph under it while its tool is
  // closed; open, the card alone stays in its place: one live graph on screen. Closing the tool brings the graph
  // back, with the positions and pick from the tool view
  return (
    <>
      <ToolCard kind="graph" summary={summaryLine} edited={Boolean(edited)} isOpen={tool.isOpen} onOpen={tool.open}>
        <div className="border-t text-xs">
          <GraphBody
            raw={raw}
            shown={shown}
            canvasClass="h-72"
            choice={choice}
            onChoice={setPicked}
            views={choices.views}
            {...filter}
            forcePositions={forcePositions}
            zoomGestures="modifier"
          />
        </div>
      </ToolCard>
      {toolFrame}
    </>
  )
}
