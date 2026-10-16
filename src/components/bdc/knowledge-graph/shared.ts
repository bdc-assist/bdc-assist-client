import { KG_CSS, type KgNode, NO_STUDY, NO_STUDY_LABEL } from '@/kg'

// What several parts of the knowledge graph panel share.

export const TYPE_LABELS: Record<KgNode['type'], string> = { concept: 'Concept', term: 'Search term', variable: 'Variable', study: 'Study' }

export type ViewMode = 'graph' | 'flow' | 'list'

// the "No study provided" placeholder as a node, for the details (it's never in the graph)
export const PLACEHOLDER: KgNode = { id: NO_STUDY, label: NO_STUDY_LABEL, type: 'study' }

// a shared node's swatch (it connects two or more seeds): a narrow halo, as in the graph
export const sharedHalo = (shared: boolean) => (shared ? { boxShadow: `0 0 0 2px ${KG_CSS.halo}` } : {})
