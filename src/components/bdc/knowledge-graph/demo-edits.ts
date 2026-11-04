import { edgeId, fromKgList, type KgEdge, type KgGraph, type KgNode } from '@/kg'

// ?tools=demo only: a stand-in for the agent that would change a graph from the tool view's chat. It knows one
// edit, "expand asthma": add asthma's related concepts, from the stub server's concept_connections fixture (a
// real Dug result). Loaded on first use. A test fixture, not src/kg's API, hence the relative import.

const ASTHMA = 'MONDO:0004979'
export const EXPAND_ASTHMA = 'Expand asthma to related concepts'

/** What the demo can do to this graph, as a suggestion for the tool's chat; none when it can do nothing. */
export function demoSuggestion(graph: KgGraph): string | null {
  return graph.nodes.some((n) => n.id === ASTHMA) ? EXPAND_ASTHMA : null
}

/** The graph after the user's message, and the reply. `graph` unchanged when the demo can't do what was asked. */
export async function demoEdit(text: string, graph: KgGraph): Promise<{ graph: KgGraph; reply: string }> {
  await new Promise((r) => setTimeout(r, 900)) // as if the agent were working
  const asthma = graph.nodes.find((n) => n.id === ASTHMA)
  if (!/\bexpand\b/i.test(text) || !/\basthma\b/i.test(text) || !asthma)
    return {
      graph,
      reply: asthma
        ? `This demo knows one change: "${EXPAND_ASTHMA}".`
        : 'This demo can only expand asthma: try it on a graph with asthma (the stub keyword concept_graph_2).',
    }
  const { kg } = await import('../../../kg/fixtures/kg/concept_connections.json')
  const related = fromKgList(kg)
  if (!related) return { graph, reply: "Couldn't load the demo's related concepts." }
  const merged = merge(graph, related)
  const added = merged.nodes.length - graph.nodes.length
  return {
    graph: merged,
    reply: added ? `Added ${added} concepts related to asthma.` : 'Asthma is already expanded: nothing new to add.',
  }
}

// nodes by id (the graph's own first: it may know a name the other has only as an id), edges by endpoints
// with their predicates joined
function merge(a: KgGraph, b: KgGraph): KgGraph {
  const nodes = new Map<string, KgNode>(a.nodes.map((n) => [n.id, n]))
  for (const n of b.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n)
  const edges = new Map<string, KgEdge>(a.edges.map((e) => [edgeId(e.source, e.target), e]))
  for (const e of b.edges) {
    const key = edgeId(e.source, e.target)
    const seen = edges.get(key)
    const predicates = [...new Set([...(seen?.predicates ?? []), ...(e.predicates ?? [])])]
    edges.set(key, { source: e.source, target: e.target, ...(predicates.length && { predicates }) })
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}
