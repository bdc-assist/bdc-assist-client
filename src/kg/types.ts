// The knowledge graph the views draw: the API's per-call `kg` graphs merged into one
// (see fromKgList in wire.ts). Everything under src/kg/ is self-contained: no imports
// from the rest of the app, no React, so it can move into another host system as-is.

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
  related_concepts_count?: number // variables: other concepts it links to (Dug: rough relevance signal)
  versions?: string[] // after collapseVersions: the versioned ids merged into this node
}

/** variable → concept, variable → study, and concept → concept (e.g. from
 * get_concept_connections) with Dug's predicates: two concepts can be related in
 * more than one way (asthma — ameliorates condition, applied to treat — epinephrine). */
export type KgEdge = { source: string; target: string; predicates?: string[] }

export type KgGraph = { nodes: KgNode[]; edges: KgEdge[] }
