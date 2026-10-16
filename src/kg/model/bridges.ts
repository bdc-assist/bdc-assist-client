import { lookup } from './query'
import { isConceptOrTerm, type KgGraph } from './types'

/**
 * The nodes that connect two or more seeds (what was asked about): studies whose
 * variables are on at least two seeds between them (cohorts with data on both), and
 * variables that are themselves on two or more. Other concepts don't count, so a
 * variable matching several synonyms isn't shared. Empty with fewer than two seeds.
 * Use it on the graph as drawn: merging releases can make a study a bridge.
 */
export function bridges(graph: KgGraph): Set<string> {
  const { type, seeds, targets, studyOf } = lookup(graph)
  const conceptsOf = new Map<string, Set<string>>() // variable or study → its seeds
  const add = (id: string, concept: string) => conceptsOf.set(id, (conceptsOf.get(id) ?? new Set()).add(concept))
  // variables only: a seed related to other concepts isn't a bridge between them
  for (const [source, ts] of targets) {
    if (type.get(source) !== 'variable') continue
    for (const t of ts) if (seeds.has(t)) add(source, t)
  }
  for (const [variable, study] of studyOf) for (const c of conceptsOf.get(variable) ?? []) add(study, c)
  return new Set([...conceptsOf].filter(([, cs]) => cs.size >= 2).map(([id]) => id))
}

/**
 * Only what the seeds share: the concepts, the bridge studies, all of their
 * variables, and any bridge variable; studies on a single seed and their
 * variables go. With no bridges, just the concepts are left.
 */
export function sharedOnly(graph: KgGraph): KgGraph {
  const shared = bridges(graph)
  const { type, studyOf } = lookup(graph)
  const keep = (id: string) => {
    const t = type.get(id)
    if (isConceptOrTerm(t) || shared.has(id)) return true
    return t === 'variable' && shared.has(studyOf.get(id) ?? '')
  }
  return {
    nodes: graph.nodes.filter((n) => keep(n.id)),
    edges: graph.edges.filter((e) => keep(e.source) && keep(e.target)),
  }
}
