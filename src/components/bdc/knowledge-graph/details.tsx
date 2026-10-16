import { ExternalLinkIcon } from 'lucide-react'

import {
  isPair,
  NO_STUDY,
  NO_STUDY_LABEL,
  NO_STUDY_NODE,
  nodeLinks,
  pairVariables,
  type KgFocus,
  type KgGraph,
  type KgLink,
  type KgNode,
} from '@/kg'

import { TYPE_LABELS } from './shared'

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

export function FocusDetails({ focus, graph }: { focus: KgFocus | null; graph: KgGraph }) {
  const byId = (id: string) => (id === NO_STUDY ? NO_STUDY_NODE : graph.nodes.find((n) => n.id === id))
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
