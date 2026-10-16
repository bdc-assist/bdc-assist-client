import type { ElementDefinition } from 'cytoscape'

import { bundles } from '../model/bundle'
import { lookup, relations, variableWeights } from '../model/query'
import { edgeId, NO_STUDY, NO_STUDY_NODE, type KgGraph } from '../model/types'

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
 * variables without a study. A bundle's `weight` is its count over `largest` (0..1): its
 * width, in proportion. `largest` defaults to the graph's own largest bundle; pass
 * another graph's (largestBundle) to keep widths when a filter hides some.
 */
export function toElements(graph: KgGraph, bundled = false, largest?: number): ElementDefinition[] {
  if (bundled) return bundledElements(graph, largest ?? largestBundle(graph))
  const { studyOf } = lookup(graph)
  const related = new Set(relations(graph))
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
      const relation = related.has(e)
      return {
        group: 'edges' as const,
        data: { id: edgeId(e.source, e.target), source: e.source, target: e.target, predicate: e.predicates?.join(' / ') },
        ...(relation && { classes: 'relation' }),
      }
    }),
  ]
}

/** The most variables in one bundle (concept × study) of `graph`; 0 without variables. */
export function largestBundle(graph: KgGraph): number {
  return bundles(graph).reduce((most, b) => Math.max(most, b.variables.length), 0)
}

function bundledElements(graph: KgGraph, largest: number): ElementDefinition[] {
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
            data: { ...NO_STUDY_NODE, order: '\uffff' }, // last
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
        weight: largest > 0 ? Math.min(1, b.variables.length / largest) : 1,
      },
      classes: 'bundle',
    })),
  ]
}
