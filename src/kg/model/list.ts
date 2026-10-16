import { lookup, variableWeights } from './query'
import { isConceptOrTerm, type KgGraph, type KgNode } from './types'

export type ListVariable = {
  variable: KgNode
  concepts: KgNode[] // the concepts it's linked to
  weight: number // variableWeights: 0..1, higher = more related concepts
}

export type ListConceptGroup = {
  concept: KgNode | null // null: variables on no concept
  variables: ListVariable[] // the study's variables on it (a concept × study pair), by label, then id
}

export type ListStudy = {
  study: KgNode | null // null: variables with no study
  concepts: KgNode[] // every concept its variables are linked to, in graph order
  variables: ListVariable[] // all of them, once each, by label, then id
  byConcept: ListConceptGroup[] // the same, grouped by concept in graph order; a variable
  // on two concepts is in both groups
}

/**
 * The graph as a list, grouped by study: each study with the concepts it covers
 * and its variables, also grouped by concept (study → concept → variables).
 * Studies covering more seeds (or concepts, without seeds) come first, then by name,
 * so with several seeds the shared studies lead; variables whose study isn't provided last. For a list or table view, or a text
 * alternative to the graph.
 */
export function studyList(graph: KgGraph): ListStudy[] {
  const { byId, studyOf, conceptsOf: conceptIdsOf } = lookup(graph)
  const conceptOrder = new Map(graph.nodes.filter((n) => isConceptOrTerm(n.type)).map((n, i) => [n.id, i]))
  const weights = variableWeights(graph)
  const conceptsOf = (id: string) => (conceptIdsOf.get(id) ?? []).map((c) => byId.get(c)!)
  const inOrder = (cs: KgNode[]) => [...new Set(cs)].sort((a, b) => conceptOrder.get(a.id)! - conceptOrder.get(b.id)!)

  const groups = new Map<string | null, ListVariable[]>()
  for (const v of graph.nodes) {
    if (v.type !== 'variable') continue
    const key = studyOf.get(v.id) ?? null
    const item = { variable: v, concepts: inOrder(conceptsOf(v.id)), weight: weights.get(v.id) ?? 1 }
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  const label = (n: KgNode | null) => n?.label ?? ''
  // how many of what was asked about a study covers (any concepts when nothing was asked about)
  const anySeeds = graph.nodes.some((n) => n.seed)
  const covered = (cs: KgNode[]) => (anySeeds ? cs.filter((c) => c.seed).length : cs.length)
  const byLabel = (a: ListVariable, b: ListVariable) =>
    a.variable.label.localeCompare(b.variable.label) || a.variable.id.localeCompare(b.variable.id)
  return [...groups]
    .map(([id, variables]) => {
      const sorted = variables.sort(byLabel)
      const concepts = inOrder(variables.flatMap((v) => v.concepts))
      const byConcept: ListConceptGroup[] = concepts.map((c) => ({
        concept: c,
        variables: sorted.filter((v) => v.concepts.includes(c)),
      }))
      const loose = sorted.filter((v) => !v.concepts.length)
      if (loose.length) byConcept.push({ concept: null, variables: loose })
      return { study: id === null ? null : byId.get(id)!, concepts, variables: sorted, byConcept }
    })
    .sort(
      (a, b) =>
        Number(a.study === null) - Number(b.study === null) ||
        covered(b.concepts) - covered(a.concepts) ||
        label(a.study).localeCompare(label(b.study)),
    )
}

/** The graph's concepts and search terms, the ones asked about (seeds) first, then in
 * graph order: the list for a graph without variables (e.g. get_concept_connections),
 * where studyList has nothing. */
export function conceptList(graph: KgGraph): KgNode[] {
  const concepts = graph.nodes.filter((n) => isConceptOrTerm(n.type))
  return [...concepts.filter((n) => n.seed), ...concepts.filter((n) => !n.seed)]
}
