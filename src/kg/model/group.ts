import { repointEdges } from './collapse'
import { lookup } from './query'
import type { KgGraph, KgNode } from './types'

/**
 * Merge concepts that have exactly the same neighbours, at least one of them a
 * variable, into one node. E.g. a search's synonyms ("body mass index", "body mass
 * index documented", …), each linked to the same variables: drawn apart, they show
 * nothing the one node doesn't. Seeds (what was asked about) and search terms are
 * never merged. The node takes the first concept's id and fields, the label
 * "<first> + N more", and lists the concepts it stands for in `grouped` (graph
 * order). Edges are re-pointed and deduplicated, keeping their predicates. Pure: the
 * input is not modified. Use after collapseVersions, which can make neighbours equal.
 */
export function groupSynonyms(graph: KgGraph): KgGraph {
  const { type, around } = lookup(graph)
  const groups = new Map<string, KgNode[]>() // sorted neighbour ids → the concepts with them
  for (const n of graph.nodes) {
    if (n.type !== 'concept' || n.seed) continue
    const ns = [...new Set((around.get(n.id) ?? []).map((a) => a.other))]
    if (!ns.some((id) => type.get(id) === 'variable')) continue
    const key = JSON.stringify(ns.sort())
    const group = groups.get(key)
    if (group) group.push(n)
    else groups.set(key, [n])
  }
  const idOf = new Map<string, string>() // a grouped concept → its group's id
  const merged = new Map<string, KgNode>()
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const [first] = members
    for (const m of members) idOf.set(m.id, first.id)
    merged.set(first.id, { ...first, label: `${first.label} + ${members.length - 1} more`, grouped: members })
  }
  if (!merged.size) return graph
  const nodes = graph.nodes.flatMap((n) => {
    const id = idOf.get(n.id)
    if (id === undefined) return [n]
    return id === n.id ? [merged.get(id)!] : []
  })
  return { nodes, edges: repointEdges(graph.edges, idOf) }
}
