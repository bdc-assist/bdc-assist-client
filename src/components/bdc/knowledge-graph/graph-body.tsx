import { MinusIcon, PlusIcon, ScanIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  isLayout,
  mountFlow,
  mountGraph,
  sameFocus,
  type FlowView,
  type GraphView,
  type KgFocus,
  type KgGraph,
  type KgViewChoices,
  type KgViewName,
} from '@/kg'

import { FocusDetails } from './details'
import { Legend } from './legend'
import { SourcePicker, ViewPicker } from './pickers'
import type { ViewMode } from './shared'
import { StudyList } from './study-list'

/** Legend, graph and the clicked node's details: one mountGraph view. Rendered
 * inline and, separately, in the maximized dialog. Carries the --kg-* colours
 * (index.css), so they apply in the dialog's portal too. */
export type GraphBodyProps = {
  raw: KgGraph // the graph as the answer has it; a new one (by content) remounts the views
  shown: KgGraph
  canvasClass: string
  choice: KgViewName // the view shown: the user's pick where this graph has it
  onChoice: (v: KgViewName) => void
  views: KgViewChoices['views'] // what the graph can show, and why not (viewChoices)
  grouped: boolean // versions and synonyms merged (the views' collapseVersions and groupSynonyms)
  onGrouped: (on: boolean) => void
  canGroup: boolean // merging changes something: offer the toggle
  variables: boolean // the graph draws each variable, not bundles (see mountGraph)
  onVariables: (on: boolean) => void
  sharedOnly: boolean
  onSharedOnly: (on: boolean) => void
  canShare: boolean // some study connects two or more seeds: offer the filter
  sources: string[] // the per-call graphs' labels (none: nothing to pick)
  source: number // which one is shown; -1: all merged
  onSource: (i: number) => void
  focus: KgFocus | null // what's picked, the same in every view, and inline and maximized
  onFocus: (f: KgFocus | null) => void
  zoomGestures: boolean | 'modifier' // see mountGraph: 'modifier' where the chat scrolls around the graph
  forcePositions: Map<string, { x: number; y: number }> // see mountGraph: shared by the panel and the dialog
  covered?: boolean // the maximized dialog is over it: when it closes, show what was moved there
  detailsBeside?: boolean // details in a column on the right, not below: picking a node never resizes the views
}

const ZOOM_STEP = 1.3
const ZOOM_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

export function GraphBody(props: GraphBodyProps) {
  const { raw, shown, canvasClass, choice, onChoice, views, sharedOnly, onSharedOnly, canShare, zoomGestures } = props
  const { sources, source, onSource, grouped, onGrouped, canGroup, forcePositions, covered, detailsBeside } = props
  const { focus, onFocus } = props
  const { variables, onVariables } = props
  const mode: ViewMode = isLayout(choice) ? 'graph' : choice
  const layout = isLayout(choice) ? choice : undefined
  const types = useMemo(() => new Set(shown.nodes.map((n) => n.type)), [shown])
  const hasSeeds = useMemo(() => shown.nodes.some((n) => n.seed), [shown])
  const bundled = mode === 'graph' && !variables
  const container = useRef<HTMLDivElement>(null)
  const view = useRef<GraphView | null>(null)
  const flowContainer = useRef<HTMLDivElement>(null)
  const flowView = useRef<FlowView | null>(null)
  const [zoomHint, setZoomHint] = useState(false)
  const hintTimer = useRef<number | undefined>(undefined)
  const showZoomHint = () => {
    setZoomHint(true)
    clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setZoomHint(false), 1500)
  }

  // mounts with the layout of the moment (Force while another view shows); later changes
  // go through setOptions below
  useEffect(() => {
    const v = mountGraph(container.current!, raw, {
      layout: layout ?? 'force',
      collapseVersions: grouped,
      groupSynonyms: grouped,
      sharedOnly,
      zoomGestures,
      variables,
      forcePositions,
      onZoomHint: showZoomHint,
      onFocus, // the host keeps it, and the other views follow (below)
    })
    view.current = v
    // the container's size can change without the window's (details reopened,
    // dialog opening animation): keep the graph fitted to it
    const observer = new ResizeObserver(() => v.resize())
    observer.observe(container.current!)
    return () => {
      observer.disconnect()
      v.destroy()
      view.current = null
      clearTimeout(hintTimer.current)
    }
  }, [raw]) // eslint-disable-line react-hooks/exhaustive-deps -- layout, grouped, sharedOnly, variables: see below

  // the flow (Sankey): its own view of the same graph, kept mounted like the graph
  useEffect(() => {
    const v = mountFlow(flowContainer.current!, raw, {
      collapseVersions: grouped,
      groupSynonyms: grouped,
      sharedOnly,
      onFocus,
    })
    flowView.current = v
    const observer = new ResizeObserver(() => v.resize()) // laid out for its size
    observer.observe(flowContainer.current!)
    return () => {
      observer.disconnect()
      v.destroy()
      flowView.current = null
    }
  }, [raw]) // eslint-disable-line react-hooks/exhaustive-deps -- grouped, sharedOnly: see below

  // another view keeps the graph's last layout
  useEffect(() => {
    if (layout) view.current?.setOptions({ layout })
  }, [layout])
  useEffect(() => view.current?.setOptions({ variables }), [variables])
  // nodes dragged in the maximized dialog moved in forcePositions only: catch up on closing
  useEffect(() => {
    if (!covered) view.current?.restorePositions()
  }, [covered])
  // the focus, picked here or in the other copy (inline or maximized): every view shows it,
  // also when just mounted (the dialog opening)
  useEffect(() => {
    view.current?.focus(focus)
    flowView.current?.focus(focus)
  }, [focus])
  // the views read their --kg-* colours once: again when the theme (the dark class) changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      view.current?.refreshStyle()
      flowView.current?.refreshStyle()
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    view.current?.setOptions({ sharedOnly })
    flowView.current?.setOptions({ sharedOnly })
  }, [sharedOnly])
  useEffect(() => {
    const o = { collapseVersions: grouped, groupSynonyms: grouped }
    view.current?.setOptions(o)
    flowView.current?.setOptions(o)
  }, [grouped])

  // picked in the list: the views show it too, for when they're switched to
  // (picking the focused row or tag again clears it, like the graph's background)
  const pickFromList = (f: KgFocus) => onFocus(sameFocus(focus, f) ? null : f)

  return (
    <div data-slot="bdc-graph" className="flex min-h-0 flex-1 flex-col text-xs">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-1.5">
        <Legend
          types={types}
          seeds={hasSeeds}
          shared={canShare}
          mode={mode}
          bundled={bundled}
        />
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {sources.length > 1 && <SourcePicker sources={sources} source={source} onSource={onSource} />}
          {canGroup && (
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={grouped} onChange={(e) => onGrouped(e.target.checked)} />
                  Group
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Merge the releases of a study or variable, and concepts linked to exactly the same things
              </TooltipContent>
            </Tooltip>
          )}
          {mode === 'graph' && types.has('variable') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={variables} onChange={(e) => onVariables(e.target.checked)} />
                  Variables
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Show each variable, instead of one link per concept and study
              </TooltipContent>
            </Tooltip>
          )}
          {canShare && (
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={sharedOnly} onChange={(e) => onSharedOnly(e.target.checked)} />
                  Shared only
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom">Only the studies with variables on two or more of the concepts asked about</TooltipContent>
            </Tooltip>
          )}
          <ViewPicker choice={choice} views={views} onChoice={onChoice} />
        </div>
      </div>
      {/* beside: the views in a column, the details next to it; below: no wrappers */}
      <div className={detailsBeside ? 'flex min-h-0 flex-1' : 'contents'}>
        <div className={detailsBeside ? 'flex min-w-0 flex-1 flex-col' : 'contents'}>
          {mode === 'list' && (
            <div className={`overflow-y-auto border-t ${canvasClass}`}>
              <StudyList graph={shown} focus={focus} onPick={pickFromList} />
            </div>
          )}
          {/* the flow's own box (mountFlow fills it) */}
          <div className={`relative border-t ${canvasClass} ${mode === 'flow' ? '' : 'hidden'}`}>
            <div
              ref={flowContainer}
              className="h-full w-full"
              aria-label="Knowledge graph as flows from concepts to studies. The List view shows the same as text."
            />
          </div>
          {/* kept mounted while another view shows, so the graph keeps its layout and zoom */}
          <div className={`relative border-t ${canvasClass} ${mode === 'graph' ? '' : 'hidden'}`}>
            {/* sized by height, not `absolute inset-0`: Cytoscape gives its container
                `position: relative` from an unlayered style sheet, which beats Tailwind's
                layered utilities, so `absolute` would be dropped and the box collapse */}
            <div
              ref={container}
              className="h-full w-full"
              role="img"
              aria-label="Knowledge graph. The List view shows the same studies and variables as text."
            />
            <p
              aria-hidden
              className={`bg-foreground/75 text-background pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-md px-3 py-1.5 transition-opacity ${zoomHint ? 'opacity-100' : 'opacity-0'}`}
            >
              Hold {ZOOM_KEY} and scroll to zoom
            </p>
            <div className="bg-background/80 absolute right-1.5 bottom-1.5 flex rounded-md border">
              <TooltipIconButton tooltip="Zoom in" side="top" onClick={() => view.current?.zoomBy(ZOOM_STEP)}>
                <PlusIcon />
              </TooltipIconButton>
              <TooltipIconButton tooltip="Zoom out" side="top" onClick={() => view.current?.zoomBy(1 / ZOOM_STEP)}>
                <MinusIcon />
              </TooltipIconButton>
              <TooltipIconButton tooltip="Show all" side="top" onClick={() => view.current?.fit()}>
                <ScanIcon />
              </TooltipIconButton>
            </div>
          </div>
        </div>
        <div
          className={detailsBeside ? 'w-80 shrink-0 overflow-y-auto border-t border-l px-3 py-2' : 'border-t px-3 py-2'}
        >
          <FocusDetails focus={focus} graph={shown} />
        </div>
      </div>
    </div>
  )
}
