import { KG_CSS, type KgNode } from '@/kg'

// What several parts of the knowledge graph panel share.

export const TYPE_LABELS: Record<KgNode['type'], string> = { concept: 'Concept', term: 'Search term', variable: 'Variable', study: 'Study' }

export type ViewMode = 'graph' | 'flow' | 'list'

// a shared node's swatch (it connects two or more seeds): a narrow halo, as in the graph
export const sharedHalo = (shared: boolean) => (shared ? { boxShadow: `0 0 0 2px ${KG_CSS.halo}` } : {})
