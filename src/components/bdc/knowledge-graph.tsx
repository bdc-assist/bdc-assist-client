import { ChevronRightIcon, ExternalLinkIcon, Maximize2Icon, MinusIcon, PlusIcon, ScanIcon } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { bridges, sharedOnly as onlyShared } from '@/kg/bridges'
import { collapseVersions } from '@/kg/collapse'
import { groupSynonyms } from '@/kg/group'
import { nodeLinks, type KgLink } from '@/kg/links'
import { studyList, type ListVariable } from '@/kg/list'
import { mountFlow, type FlowView } from '@/kg/flow'
import { focusConnections, isPair, pairVariables, sameFocus, type KgFocus } from '@/kg/focus'
import { mountGraph, type GraphView, type KgLayout } from '@/kg/mount'
import { graphShape, KG_VIEWS, type KgViewChoice, type KgViewName } from '@/kg/shape'
import { isConceptOrTerm, NO_STUDY, NO_STUDY_LABEL, type KgGraph, type KgNode } from '@/kg/types'
import type { KgPart } from '@/kg/wire'

// The demo's wrapper around src/kg (loaded on demand: see GraphUI in message-parts.tsx):
// a collapsible panel under the answer with the graph, or the same as a list, and
// the selected node's details, plus a button to show it all in a large dialog.
// Another host would write its own wrapper around mountGraph and studyList;
// nothing in src/kg depends on this file.

const TYPE_LABELS: Record<KgNode['type'], string> = { concept: 'Concept', term: 'Search term', variable: 'Variable', study: 'Study' }

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

// Swatches drawn like the nodes: same --kg-* colours (index.css), same shapes; the
// tooltip says what each is
const LEGEND: { type: KgNode['type']; shape: string; background: string; border?: string; tip: string }[] = [
  {
    type: 'concept',
    shape: 'size-3 rounded-full',
    background: 'var(--kg-concept)',
    tip: 'A Dug concept from an ontology',
  },
  {
    type: 'term', // tinted, with a border
    shape: 'size-3 rounded-full border-2',
    background: 'color-mix(in srgb, var(--kg-concept) 30%, transparent)',
    border: 'var(--kg-concept)',
    tip: 'A word searched for; not matched to a concept',
  },
  {
    type: 'variable', // the colour ramp
    shape: 'h-2.5 w-5 rounded-full',
    background: 'linear-gradient(to right, var(--kg-variable-low), var(--kg-variable-high))',
    tip: 'One study variable; the stronger the blue, the more concepts it links to',
  },
  {
    type: 'study',
    shape: 'size-2.5 rounded-[2px]',
    background: 'var(--kg-study)',
    tip: 'A dbGaP study; its variables link it to concepts',
  },
]

// Flow draws variables as bands, not nodes: flat mid-blue, as translucent as the bands
const BAND: { shape: string; background: string; border?: string; tip: string } = {
  shape: 'h-1.5 w-5 rounded-sm',
  background: 'color-mix(in srgb, color-mix(in srgb, var(--kg-variable-low), var(--kg-variable-high)) 45%, transparent)',
  tip: 'The variables linking a concept and a study; its width shows how many',
}

// the halo colour at its opacity, as mountGraph draws seed and shared halos and seed labels
const HALO = 'color-mix(in srgb, var(--kg-halo) calc(var(--kg-halo-opacity) * 100%), transparent)'

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

function Legend({ types, seeds, shared, mode, bundled }: LegendProps) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {LEGEND.filter((l) => types.has(l.type)).map((l) => {
        const bands = l.type === 'variable' && (mode === 'flow' || bundled)
        const { shape, background, border, tip } = bands ? BAND : l
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
              ? 'What the question asked about. A smaller halo marks what links two or more of them: shared'
              : 'What the question asked about'
          }
        >
          <span className="text-foreground rounded-sm px-1 font-bold" style={{ background: HALO }}>
            Queried
          </span>
        </LegendItem>
      )}
    </ul>
  )
}

type ViewMode = 'graph' | 'flow' | 'list'

const VIEW_LABELS: Record<KgViewName, string> = {
  radial: 'Radial',
  force: 'Force',
  flow: 'Flow',
  list: 'List',
}

/** One dropdown for the graph's layouts, the flow (Sankey) and the list: a layout is a
 * mountGraph option, flow is mountFlow, the list is this wrapper's own, but to the
 * user they're all ways to view it. */
function ViewPicker({ choice, available, onChoice }: Pick<GraphBodyProps, 'choice' | 'available' | 'onChoice'>) {
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
function SourcePicker({ sources, source, onSource }: { sources: string[]; source: number; onSource: (i: number) => void }) {
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

function ExternalLink({ link }: { link: KgLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono underline-offset-2 hover:underline"
    >
      {link.label}
      <ExternalLinkIcon className="size-3" />
    </a>
  )
}

// The ID is shown as its link(s): a concept's ontology page, or one dbGaP page per
// release of a study or variable (merged releases list each versioned ID).
function NodeDetails({ node, graph }: { node: KgNode; graph: KgGraph }) {
  if (node.type === 'term') {
    // find_cohort_variables reports the words it searched for, not concept ids
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">Search term</dt>
        <dd className="font-medium">{node.label}</dd>
        <dt className="text-muted-foreground">ID</dt>
        <dd className="text-muted-foreground">None: matched by search, not a resolved concept</dd>
      </dl>
    )
  }
  const all = nodeLinks(node, graph)
  const links = all.filter((l) => !l.note) // the node's own pages
  const standIns = all.filter((l) => l.note) // e.g. a variable without a dbGaP accession: its study
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <dt className="text-muted-foreground">{TYPE_LABELS[node.type]}</dt>
      <dd className="font-medium">{node.label}</dd>
      {node.description && node.description !== node.label && (
        <>
          <dt className="text-muted-foreground">Description</dt>
          <dd>{node.description}</dd>
        </>
      )}
      {node.grouped ? (
        // concepts merged by groupSynonyms (e.g. a search's synonyms): each with its page
        <>
          <dt className="text-muted-foreground">Concepts</dt>
          <dd>
            <ul className="max-h-32 overflow-y-auto">
              {node.grouped.map((c) => {
                const link = nodeLinks(c, graph)[0]
                return (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span>{c.label}</span>
                    <span className="font-mono">{link ? <ExternalLink link={link} /> : c.id}</span>
                    {c.concept_type && <span className="text-muted-foreground">{c.concept_type}</span>}
                  </li>
                )
              })}
            </ul>
          </dd>
        </>
      ) : (
        <>
          <dt className="text-muted-foreground">{links.length > 1 ? 'IDs' : 'ID'}</dt>
          <dd className="flex flex-wrap gap-x-3 font-mono">
            {links.length ? links.map((l) => <ExternalLink key={l.url} link={l} />) : node.id}
          </dd>
          {node.concept_type && (
            <>
              {/* Dug's category, as sent (e.g. NamedThing, biolink:Activity) */}
              <dt className="text-muted-foreground">Category</dt>
              <dd>{node.concept_type}</dd>
            </>
          )}
        </>
      )}
      {node.type === 'variable' && !all.length && (
        <>
          <dt className="text-muted-foreground">dbGaP</dt>
          {/* its dbGaP page needs the study, and e.g. search_concepts doesn't give it */}
          <dd className="text-muted-foreground">No study provided</dd>
        </>
      )}
      {standIns.length > 0 && (
        <>
          <dt className="text-muted-foreground">dbGaP</dt>
          <dd className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-muted-foreground">{standIns[0].note} ·</span>
            {standIns.map((l) => (
              <ExternalLink key={l.url} link={{ ...l, label: `study ${l.label}` }} />
            ))}
          </dd>
        </>
      )}
      {node.related_concepts_count !== undefined && (
        <>
          <dt className="text-muted-foreground">Other concepts</dt>
          <dd>{node.related_concepts_count}</dd>
        </>
      )}
    </dl>
  )
}

/** A concept × study pair: both, and the study's variables on the concept, each
 * linking to its dbGaP page. */
function PairDetails({ concept, study, graph }: { concept: KgNode; study: KgNode; graph: KgGraph }) {
  const variables = pairVariables(graph, concept.id, study.id)
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <dt className="text-muted-foreground">{TYPE_LABELS[concept.type]}</dt>
      <dd className="font-medium">{concept.label}</dd>
      <dt className="text-muted-foreground">Study</dt>
      <dd className="font-medium">{study.label}</dd>
      <dt className="text-muted-foreground">Variables</dt>
      <dd className="flex max-h-24 flex-wrap gap-x-3 overflow-y-auto font-mono">
        {variables.map((v) => {
          // only a variable's own page; one without a dbGaP accession stays plain text
          const link = nodeLinks(v, graph).find((l) => !l.note)
          return link ? <ExternalLink key={v.id} link={{ ...link, label: v.label }} /> : <span key={v.id}>{v.label}</span>
        })}
      </dd>
    </dl>
  )
}

// the "No study provided" placeholder as a node, for the details (it's never in the graph)
const PLACEHOLDER: KgNode = { id: NO_STUDY, label: NO_STUDY_LABEL, type: 'study' }

function FocusDetails({ focus, graph }: { focus: KgFocus | null; graph: KgGraph }) {
  const byId = (id: string) => (id === NO_STUDY ? PLACEHOLDER : graph.nodes.find((n) => n.id === id))
  if (focus && !isPair(focus) && focus.node === NO_STUDY) {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">Study</dt>
        <dd className="font-medium">{NO_STUDY_LABEL}</dd>
      </dl>
    )
  }
  if (focus && isPair(focus)) {
    const [concept, study] = [byId(focus.concept), byId(focus.study)]
    if (concept && study) return <PairDetails concept={concept} study={study} graph={graph} />
  }
  const node = focus && !isPair(focus) ? byId(focus.node) : undefined
  if (node) return <NodeDetails node={node} graph={graph} />
  return <p className="text-muted-foreground">Click a node for details.</p>
}

// The list marks the focus its own way (DESIGN.md §4): the focused row is shaded,
// clearly more than a hovered one; rows outside the focus's connections dim to 0.35,
// since they're text to read
const rowClass = (selected: boolean, dimmed: boolean) =>
  `flex min-w-0 flex-1 items-baseline gap-2 rounded-md px-1.5 py-1 text-start transition-opacity ${selected ? 'bg-foreground/10' : 'hover:bg-foreground/5'} ${dimmed ? 'opacity-35' : ''}`

// a shared node's swatch (it connects two or more seeds): a narrow halo, as in the graph
const sharedHalo = (shared: boolean) => (shared ? { boxShadow: `0 0 0 2px ${HALO}` } : {})

// a node's name; a seed's (what was asked about) is highlighted and bold, as in the legend
function NodeLabel({ node, className = '' }: { node: KgNode; className?: string }) {
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
function ConceptMark({ concept, shared }: { concept: KgNode; shared: boolean }) {
  const colour =
    concept.type === 'term'
      ? { border: '1.5px solid var(--kg-concept)', background: 'color-mix(in srgb, var(--kg-concept) 30%, transparent)' }
      : { background: 'var(--kg-concept)' }
  return <span className="size-2 shrink-0 self-center rounded-full" style={{ ...colour, ...sharedHalo(shared) }} />
}

/** The graph as text: studies (foldable), each with a row per concept (that
 * concept × study pair) and the variables under it (studyList). Without any studies
 * (e.g. a search), concepts (foldable) with their variables instead. Study, concept
 * and variable rows focus like nodes in the graph, pair rows focus their pair; picking
 * the focused row again clears it. Rows dim like the graph when not connected to the focus. */
function StudyList({ graph, focus, onPick }: { graph: KgGraph; focus: KgFocus | null; onPick: (f: KgFocus) => void }) {
  const groups = useMemo(() => studyList(graph), [graph])
  const linked = useMemo(() => (focus ? focusConnections(graph, focus).nodes : null), [graph, focus])
  const shared = useMemo(() => bridges(graph), [graph])
  const dimmed = (id: string) => linked !== null && !linked.has(id)
  const isNode = (id: string) => !!focus && !isPair(focus) && focus.node === id
  const isPairOf = (concept: string, study: string) =>
    !!focus && isPair(focus) && focus.concept === concept && focus.study === study
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setFolded((f) => {
      const next = new Set(f)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const foldButton = (key: string, label: string) => {
    const open = !folded.has(key)
    return (
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${open ? 'Fold' : 'Unfold'} ${label}`}
        onClick={() => toggle(key)}
        className="text-muted-foreground hover:text-foreground rounded p-1"
      >
        <ChevronRightIcon className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
    )
  }
  const variableRows = (vs: ListVariable[]) => (
    <ul className="pl-6">
      {vs.map(({ variable, weight }) => (
        <li key={variable.id} className="flex">
          <button
            type="button"
            onClick={() => onPick({ node: variable.id })}
            aria-current={isNode(variable.id) || undefined}
            className={rowClass(isNode(variable.id), dimmed(variable.id))}
          >
            <span
              className="size-2 shrink-0 self-center rounded-full"
              style={{
                background: `color-mix(in srgb, var(--kg-variable-high) ${Math.round(weight * 100)}%, var(--kg-variable-low))`,
                ...sharedHalo(shared.has(variable.id)),
              }}
            />
            <NodeLabel node={variable} className="font-mono" />
            {variable.description && variable.description !== variable.label && (
              <span className="truncate">{variable.description}</span>
            )}
            <span className="text-muted-foreground truncate font-mono">{variable.id}</span>
          </button>
        </li>
      ))}
    </ul>
  )

  if (!groups.length) {
    // no variables (e.g. concept_connections): just the concepts, the ones asked about first
    const concepts = graph.nodes.filter((n) => isConceptOrTerm(n.type)).sort((a, b) => Number(!!b.seed) - Number(!!a.seed))
    return (
      <ul aria-label="Concepts" className="divide-y">
        {concepts.map((concept) => (
          <li key={concept.id} className="flex px-1.5 py-1">
            <button
              type="button"
              onClick={() => onPick({ node: concept.id })}
              aria-current={isNode(concept.id) || undefined}
              className={rowClass(isNode(concept.id), dimmed(concept.id))}
            >
              <ConceptMark concept={concept} shared={shared.has(concept.id)} />
              <NodeLabel node={concept} className="truncate font-medium" />
              {concept.type === 'term' && <span className="text-muted-foreground shrink-0">(search term)</span>}
              {concept.concept_type && <span className="text-muted-foreground truncate">{concept.concept_type}</span>}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  if (groups.length === 1 && !groups[0].study) {
    // no studies at all (e.g. search_concepts): a heading per concept instead
    return (
      <ul aria-label="Concepts and their variables" className="divide-y">
        {groups[0].byConcept.map(({ concept, variables: vs }) => {
          const key = concept?.id ?? '(no concept)'
          return (
            <li key={key} className="px-1.5 py-1">
              <div className="flex items-center gap-0.5">
                {foldButton(key, concept?.label ?? 'variables without a concept')}
                {concept ? (
                  <button
                    type="button"
                    onClick={() => onPick({ node: concept.id })}
                    aria-current={isNode(concept.id) || undefined}
                    className={rowClass(isNode(concept.id), dimmed(concept.id))}
                  >
                    <ConceptMark concept={concept} shared={shared.has(concept.id)} />
                    <NodeLabel node={concept} className="truncate font-medium" />
                    {concept.type === 'term' && <span className="text-muted-foreground shrink-0">(search term)</span>}
                    <span className="text-muted-foreground shrink-0">· {vs.length}</span>
                  </button>
                ) : (
                  <span className="text-muted-foreground px-1.5 py-1">No concept</span>
                )}
              </div>
              {!folded.has(key) && variableRows(vs)}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul aria-label="Studies, their concepts and variables" className="divide-y">
      {groups.map(({ study: real, variables, byConcept }) => {
        // variables whose study Dug didn't provide (e.g. search_concepts): the "No study provided"
        // placeholder, last, outlined in grey; it focuses like a study
        const study = real ?? PLACEHOLDER
        return (
          <li key={study.id} className="px-1.5 py-1">
            <div className="flex items-center gap-0.5">
              {foldButton(study.id, real ? study.label : 'variables whose study is not provided')}
              <button
                type="button"
                onClick={() => onPick({ node: study.id })}
                aria-current={isNode(study.id) || undefined}
                className={rowClass(isNode(study.id), dimmed(study.id))}
              >
                <span
                  className="size-2 shrink-0 self-center rounded-[2px]"
                  style={
                    real
                      ? { background: 'var(--kg-study)', ...sharedHalo(shared.has(study.id)) }
                      : { border: '1.5px solid var(--kg-label)' }
                  }
                />
                <NodeLabel node={study} className={`truncate font-medium ${real ? '' : 'text-muted-foreground'}`} />
                {real && <span className="text-muted-foreground shrink-0 font-mono">{study.id}</span>}
                <span className="text-muted-foreground shrink-0">· {variables.length}</span>
              </button>
            </div>
            {!folded.has(study.id) && (
              <ul className="pl-6">
                {byConcept.map(({ concept, variables: vs }) => (
                  <li key={concept?.id ?? '(no concept)'}>
                    <div className="flex">
                      {concept ? (
                        <button
                          type="button"
                          title={real ? `What this study has on ${concept.label}` : `${concept.label}: variables with no study provided`}
                          onClick={() => onPick({ concept: concept.id, study: study.id })}
                          aria-current={isPairOf(concept.id, study.id) || undefined}
                          // a pair row: lit only when both its concept and its study are
                          className={rowClass(isPairOf(concept.id, study.id), dimmed(concept.id) || dimmed(study.id))}
                        >
                          <ConceptMark concept={concept} shared={shared.has(concept.id)} />
                          <NodeLabel node={concept} />
                          {concept.type === 'term' && <span className="text-muted-foreground shrink-0">(search term)</span>}
                          <span className="text-muted-foreground shrink-0">· {vs.length}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground px-1.5 py-1">No concept</span>
                      )}
                    </div>
                    {variableRows(vs)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Legend, graph and the clicked node's details: one mountGraph view. Rendered
 * inline and, separately, in the maximized dialog. Carries the --kg-* colours
 * (index.css), so they apply in the dialog's portal too. */
type GraphBodyProps = {
  json: string
  shown: KgGraph
  canvasClass: string
  choice: KgViewName // the view shown: the user's pick where this graph has it
  onChoice: (v: KgViewName) => void
  available: KgViewChoice['available'] // what the graph can show (graphShape)
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
  zoomGestures: boolean | 'modifier' // see mountGraph: 'modifier' where the chat scrolls around the graph
  forcePositions: Map<string, { x: number; y: number }> // see mountGraph: shared by the panel and the dialog
  covered?: boolean // the maximized dialog is over it: when it closes, show what was moved there
  detailsBeside?: boolean // details in a column on the right, not below: picking a node never resizes the views
}

const ZOOM_STEP = 1.3
const ZOOM_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

function GraphBody(props: GraphBodyProps) {
  const { json, shown, canvasClass, choice, onChoice, available, sharedOnly, onSharedOnly, canShare, zoomGestures } = props
  const { sources, source, onSource, grouped, onGrouped, canGroup, forcePositions, covered, detailsBeside } = props
  const { variables, onVariables } = props
  const mode: ViewMode = choice === 'flow' || choice === 'list' ? choice : 'graph'
  const layout: KgLayout | undefined = mode === 'graph' ? (choice as KgLayout) : undefined
  const types = useMemo(() => new Set(shown.nodes.map((n) => n.type)), [shown])
  const hasSeeds = useMemo(() => shown.nodes.some((n) => n.seed), [shown])
  const bundled = mode === 'graph' && !variables
  const container = useRef<HTMLDivElement>(null)
  const view = useRef<GraphView | null>(null)
  const flowContainer = useRef<HTMLDivElement>(null)
  const flowView = useRef<FlowView | null>(null)
  // what's picked, the same in every view: a node or a concept × study pair
  const [focus, setFocus] = useState<KgFocus | null>(null)
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
    const v = mountGraph(container.current!, JSON.parse(json) as KgGraph, {
      layout: layout ?? 'force',
      collapseVersions: grouped,
      groupSynonyms: grouped,
      sharedOnly,
      zoomGestures,
      variables,
      forcePositions,
      onZoomHint: showZoomHint,
      onFocus: (f) => {
        setFocus(f)
        flowView.current?.focus(f) // the other view follows
      },
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
      setFocus(null)
      clearTimeout(hintTimer.current)
    }
  }, [json]) // eslint-disable-line react-hooks/exhaustive-deps -- layout, grouped, sharedOnly, variables: see below

  // the flow (Sankey): its own view of the same graph, kept mounted like the graph
  useEffect(() => {
    const v = mountFlow(flowContainer.current!, JSON.parse(json) as KgGraph, {
      collapseVersions: grouped,
      groupSynonyms: grouped,
      sharedOnly,
      onFocus: (f) => {
        setFocus(f)
        view.current?.focus(f)
      },
    })
    flowView.current = v
    const observer = new ResizeObserver(() => v.resize()) // laid out for its size
    observer.observe(flowContainer.current!)
    return () => {
      observer.disconnect()
      v.destroy()
      flowView.current = null
    }
  }, [json]) // eslint-disable-line react-hooks/exhaustive-deps -- grouped, sharedOnly: see below

  // another view keeps the graph's last layout
  useEffect(() => {
    if (layout) view.current?.setOptions({ layout })
  }, [layout])
  useEffect(() => view.current?.setOptions({ variables }), [variables])
  // nodes dragged in the maximized dialog moved in forcePositions only: catch up on closing
  useEffect(() => {
    if (!covered) view.current?.restorePositions()
  }, [covered])
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

  // picked in the list: both views show it too, for when they're switched to
  // (picking the focused row or tag again clears it, like the graph's background)
  const pickFromList = (f: KgFocus) => {
    const next = sameFocus(focus, f) ? null : f
    setFocus(next)
    view.current?.focus(next)
    flowView.current?.focus(next)
  }

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
          <ViewPicker choice={choice} available={available} onChoice={onChoice} />
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
  const all = useMemo(() => groupSynonyms(collapseVersions(raw)), [raw])
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
  // what the list and the details see: the same as mountGraph draws
  const shown = useMemo(() => (sharedOnly ? onlyShared(merged) : merged), [merged, sharedOnly])
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
