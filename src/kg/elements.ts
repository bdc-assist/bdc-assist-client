import type { ElementDefinition } from 'cytoscape'

import { bundles } from './bundle'
import { edgeId, NO_STUDY, NO_STUDY_LABEL, type KgGraph } from './types'

/** The concept → concept edges: relationships between concepts (e.g. from
 * get_concept_connections), as opposed to variables' links. */
export function relations(graph: KgGraph): KgGraph['edges'] {
  const types = new Map(graph.nodes.map((n) => [n.id, n.type]))
  return graph.edges.filter((e) => types.get(e.source) === 'concept' && types.get(e.target) === 'concept')
}

/** Each variable's related_concepts_count scaled to 0..1 within the graph: 1 for the
 * highest, 0 for the lowest; 1 when its count is missing or all counts are equal. */
export function variableWeights(graph: KgGraph): Map<string, number> {
  const counts = graph.nodes.flatMap((n) =>
    n.type === 'variable' && n.related_concepts_count !== undefined ? [n.related_concepts_count] : [],
  )
  const [lo, hi] = [Math.min(...counts), Math.max(...counts)]
  return new Map(
    graph.nodes
      .filter((n) => n.type === 'variable')
      .map((n) => {
        const c = n.related_concepts_count
        return [n.id, c === undefined || !(hi > lo) ? 1 : (c - lo) / (hi - lo)]
      }),
  )
}

/**
 * Cytoscape elements for a graph. Each node's data carries `order`, the key the
 * radial layout sorts by within a ring: studies by id, variables by their study's
 * id, so a study's variables sit together, next to it. Variables also carry
 * `weight` (variableWeights), drawn as a light-to-dark colour; seeds carry `seed`. Concept → concept
 * edges get the class `relation`, and every edge its predicates joined as `predicate`.
 *
 * `bundled`: no variables; instead one edge per concept and study (class `bundle`,
 * id "bundle:concept->study", data `concept`, `study`, its `variables` and their `count`), and the "No study
 * provided" placeholder (id NO_STUDY, class `placeholder`, last in its ring) for
 * variables without a study.
 */
export function toElements(graph: KgGraph, bundled = false): ElementDefinition[] {
  if (bundled) return bundledElements(graph)
  const studyOf = new Map<string, string>() // variable id → study id
  const types = new Map(graph.nodes.map((n) => [n.id, n.type]))
  for (const e of graph.edges) if (types.get(e.target) === 'study') studyOf.set(e.source, e.target)
  const order = (id: string, type: string) => (type === 'variable' ? `${studyOf.get(id) ?? ''} ${id}` : id)
  const weights = variableWeights(graph)
  return [
    ...graph.nodes.map((n) => ({
      group: 'nodes' as const,
      data: {
        id: n.id,
        label: n.label,
        type: n.type,
        order: order(n.id, n.type),
        ...(n.type === 'variable' && { weight: weights.get(n.id) }),
        ...(n.seed && { seed: true }),
      },
    })),
    ...graph.edges.map((e) => {
      // concept → concept: a relationship between concepts (class `relation`), named by Dug
      const relation = types.get(e.source) === 'concept' && types.get(e.target) === 'concept'
      return {
        group: 'edges' as const,
        data: { id: edgeId(e.source, e.target), source: e.source, target: e.target, predicate: e.predicates?.join(' / ') },
        ...(relation && { classes: 'relation' }),
      }
    }),
  ]
}

function bundledElements(graph: KgGraph): ElementDefinition[] {
  const all = bundles(graph)
  const variables = new Set(graph.nodes.filter((n) => n.type === 'variable').map((n) => n.id))
  const rest: KgGraph = {
    nodes: graph.nodes.filter((n) => !variables.has(n.id)),
    edges: graph.edges.filter((e) => !variables.has(e.source) && !variables.has(e.target)),
  }
  const placeholder = all.some((b) => b.study === NO_STUDY)
  return [
    ...toElements(rest),
    ...(placeholder
      ? [
          {
            group: 'nodes' as const,
            data: { id: NO_STUDY, label: NO_STUDY_LABEL, type: 'study', order: '\uffff' }, // last
            classes: 'placeholder',
          },
        ]
      : []),
    ...all.map((b) => ({
      group: 'edges' as const,
      data: {
        id: `bundle:${edgeId(b.concept, b.study)}`,
        source: b.concept,
        target: b.study,
        concept: b.concept,
        study: b.study,
        variables: b.variables,
        count: b.variables.length,
      },
      classes: 'bundle',
    })),
  ]
}
