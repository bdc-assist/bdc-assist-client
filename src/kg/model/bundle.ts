import { isConceptOrTerm, NO_STUDY, type KgGraph } from './types'

/** The variables a study has on a concept, as one link. The study can be NO_STUDY: the
 * concept's variables whose study isn't provided. */
export type Bundle = { concept: string; study: string; variables: string[] }

/**
 * The graph's variables as bundles: one per concept and study, listing the study's
 * variables on that concept (graph order). A variable on two concepts is in both.
 * Bundles to real studies come first, then those to NO_STUDY, each in the order
 * their first variable appears. Flow draws them as bands, node-link as links.
 */
export function bundles(graph: KgGraph): Bundle[] {
  const type = new Map(graph.nodes.map((n) => [n.id, n.type]))
  const studyOf = new Map<string, string>()
  const conceptsOf = new Map<string, string[]>()
  for (const e of graph.edges) {
    const t = type.get(e.target)
    if (t === 'study') studyOf.set(e.source, e.target)
    if (isConceptOrTerm(t)) conceptsOf.set(e.source, [...(conceptsOf.get(e.source) ?? []), e.target])
  }
  const real = new Map<string, Bundle>()
  const loose = new Map<string, Bundle>() // concept → NO_STUDY
  for (const n of graph.nodes) {
    if (n.type !== 'variable') continue
    const study = studyOf.get(n.id) ?? NO_STUDY
    const into = study === NO_STUDY ? loose : real
    for (const concept of conceptsOf.get(n.id) ?? []) {
      const key = JSON.stringify([concept, study])
      const bundle = into.get(key) ?? { concept, study, variables: [] }
      bundle.variables.push(n.id)
      into.set(key, bundle)
    }
  }
  return [...real.values(), ...loose.values()]
}
