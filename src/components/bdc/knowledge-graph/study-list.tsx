import { ChevronRightIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  bridges,
  focusConnections,
  KG_CSS,
  isConceptOrTerm,
  isPair,
  studyList,
  type KgFocus,
  type KgGraph,
  type ListVariable,
} from '@/kg'

import { ConceptMark, NodeLabel } from './marks'
import { PLACEHOLDER, sharedHalo } from './shared'

// The list marks the focus its own way (DESIGN.md §4): the focused row is shaded,
// clearly more than a hovered one; rows outside the focus's connections dim less than
// in the views (KG_CSS.listFaded), since they're text to read
const row = (selected: boolean, dimmed: boolean) => ({
  className: `flex min-w-0 flex-1 items-baseline gap-2 rounded-md px-1.5 py-1 text-start transition-opacity ${selected ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`,
  style: dimmed ? { opacity: KG_CSS.listFaded } : undefined,
})

/** The graph as text: studies (foldable), each with a row per concept (that
 * concept × study pair) and the variables under it (studyList). Without any studies
 * (e.g. a search), concepts (foldable) with their variables instead. Study, concept
 * and variable rows focus like nodes in the graph, pair rows focus their pair; picking
 * the focused row again clears it. Rows dim like the graph when not connected to the focus. */
export function StudyList({ graph, focus, onPick }: { graph: KgGraph; focus: KgFocus | null; onPick: (f: KgFocus) => void }) {
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
            {...row(isNode(variable.id), dimmed(variable.id))}
          >
            <span
              className="size-2 shrink-0 self-center rounded-full"
              style={{
                background: KG_CSS.variable(weight),
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
              {...row(isNode(concept.id), dimmed(concept.id))}
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
                    {...row(isNode(concept.id), dimmed(concept.id))}
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
                {...row(isNode(study.id), dimmed(study.id))}
              >
                <span
                  className="size-2 shrink-0 self-center rounded-[2px]"
                  style={
                    real
                      ? { background: KG_CSS.study, ...sharedHalo(shared.has(study.id)) }
                      : { border: `1.5px solid ${KG_CSS.placeholder}` }
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
                          {...row(isPairOf(concept.id, study.id), dimmed(concept.id) || dimmed(study.id))}
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
