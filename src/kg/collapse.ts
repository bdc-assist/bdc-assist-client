import type { KgGraph, KgNode } from './types'

// dbGaP accessions end in ".v<version>.p<participant set>": phs000007.v34.p15, phv00001546.v1.p12
const VERSION = /\.v\d+\.p\d+$/

/** The accession without its version: "phs000007.v34.p15" → "phs000007". Ids
 * without a version (concepts) come back unchanged. */
export const baseId = (id: string) => id.replace(VERSION, '')

/**
 * Merge the releases of the same study or variable into one node, e.g. Framingham
 * phs000007.v31.p12 and phs000007.v34.p15 → phs000007. A merged node takes the
 * base id, the first release's label and fields, and lists every versioned id it
 * stands for in `versions` (first-seen order), so links to a specific release
 * stay possible. Every study and variable gets `versions`, even with one release.
 * Concepts and terms are left alone. Edges are re-pointed and deduplicated, keeping
 * their predicates. Pure: the input is not modified.
 */
export function collapseVersions(graph: KgGraph): KgGraph {
  const nodes = new Map<string, KgNode>()
  const idOf = new Map<string, string>() // original id → collapsed id
  for (const n of graph.nodes) {
    const versioned = n.type === 'variable' || n.type === 'study'
    const id = versioned ? baseId(n.id) : n.id
    idOf.set(n.id, id)
    const merged = nodes.get(id)
    if (!merged) nodes.set(id, versioned ? { ...n, id, versions: [n.id] } : { ...n })
    else if (merged.versions && !merged.versions.includes(n.id)) merged.versions.push(n.id)
  }
  const edges = new Map<string, KgGraph['edges'][number]>()
  for (const e of graph.edges) {
    const source = idOf.get(e.source) ?? e.source
    const target = idOf.get(e.target) ?? e.target
    const key = JSON.stringify([source, target])
    const seen = edges.get(key)
    // releases merged into one pair: keep every way they're related
    const predicates = [...new Set([...(seen?.predicates ?? []), ...(e.predicates ?? [])])]
    edges.set(key, { source, target, ...(predicates.length && { predicates }) })
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}
