// The knowledge graph the views draw: the API's per-call `kg` graphs merged into one
// (see fromKgList in wire.ts).

/** A term is a search word standing in for a concept (find_cohort_variables): its id is
 * the word, and it has no link or category. */
export type KgNodeType = 'concept' | 'term' | 'variable' | 'study'

/** Concepts and terms play the same part in a graph: what its variables are about. */
export const isConceptOrTerm = (type: KgNodeType | undefined) => type === 'concept' || type === 'term'

export type KgNode = {
  id: string // concept id, search word, dbGaP variable accession, or dbGaP study accession (with version)
  label: string
  type: KgNodeType
  concept_type?: string // concepts: Dug's category, verbatim
  seed?: true // a call asked about it (the API's `seeds`): what the user asked about, not what came back
  description?: string // Dug's, verbatim (search_concepts variables have one)
  related_concepts_count?: number // variables: other concepts it links to (Dug: rough relevance signal)
  grouped?: KgNode[] // after groupSynonyms: the concepts merged into this node, first first
  versions?: string[] // after collapseVersions: the versioned ids merged into this node
}

/** variable → concept, variable → study, and concept → concept (e.g. from
 * get_concept_connections) with Dug's predicates: two concepts can be related in
 * more than one way (asthma — ameliorates condition, applied to treat — epinephrine). */
export type KgEdge = { source: string; target: string; predicates?: string[] }

/** An edge's id, as the views and highlighting (Connections) use it: "source->target". */
export const edgeId = (source: string, target: string) => `${source}->${target}`

export type KgGraph = { nodes: KgNode[]; edges: KgEdge[] }

/** Edges with their ends renamed (`idOf`: old id → new id; others stay), one per
 * pair, keeping every predicate of the edges merged into it. For merging nodes. */
export function repointEdges(edges: KgEdge[], idOf: Map<string, string>): KgEdge[] {
  const out = new Map<string, KgEdge>()
  for (const e of edges) {
    const source = idOf.get(e.source) ?? e.source
    const target = idOf.get(e.target) ?? e.target
    const key = JSON.stringify([source, target])
    const seen = out.get(key)
    const predicates = [...new Set([...(seen?.predicates ?? []), ...(e.predicates ?? [])])]
    out.set(key, { source, target, ...(predicates.length && { predicates }) })
  }
  return [...out.values()]
}

/** The "No study provided" placeholder: views gather the variables whose study Dug didn't
 * provide under it. It's never a node in a KgGraph (nothing is inferred), so this id can't
 * clash with one; it's left out of study counts and "shared". Focus it like a study:
 * { node: NO_STUDY }, or { concept, study: NO_STUDY } for a concept's study-less variables. */
export const NO_STUDY = '(no study provided)'
export const NO_STUDY_LABEL = 'No study provided'

/** The placeholder as a node, for showing it like one (a bar, a row, details). */
export const NO_STUDY_NODE: KgNode = Object.freeze({ id: NO_STUDY, label: NO_STUDY_LABEL, type: 'study' })
