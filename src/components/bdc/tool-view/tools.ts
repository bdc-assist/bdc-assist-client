import { ClipboardPenIcon, createLucideIcon, type LucideIcon } from 'lucide-react'

// Demo only for now: ?tools=demo turns the tool view on; without it the graph keeps its maximize dialog.
// typeof: read on import, which also happens outside a browser (tests under Node have no location)
export const TOOLS_DEMO =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('tools') === 'demo'

// lucide's graph-star, newer than our lucide-react (1.50.0): drawn from its SVG until we upgrade, then import it
const GraphStarIcon = createLucideIcon('graph-star', [
  ['path', { d: 'm12.342 9.316 1.764-3.527', key: 'a' }],
  ['path', { d: 'm12.59 14.545 2.35 3.759', key: 'b' }],
  ['path', { d: 'm13.982 12.332 4.03.447', key: 'c' }],
  ['path', { d: 'M5.414 17.586 8.88 14.12', key: 'd' }],
  ['path', { d: 'M9.025 9.742 5.317 5.505', key: 'e' }],
  ['circle', { cx: '11', cy: '12', r: '3', key: 'f' }],
  ['circle', { cx: '15', cy: '4', r: '2', key: 'g' }],
  ['circle', { cx: '16', cy: '20', r: '2', key: 'h' }],
  ['circle', { cx: '20', cy: '13', r: '2', key: 'i' }],
  ['circle', { cx: '4', cy: '19', r: '2', key: 'j' }],
  ['circle', { cx: '4', cy: '4', r: '2', key: 'k' }],
])

// each tool's icon and name (its card and its header), its card's open button label (what you'd do there; the
// tooltip says where it opens), and its starting layout: its share of the width, and
// whether the conversation starts hidden. A graph gets more room than a form
export const TOOLS: Record<
  'graph' | 'form',
  { icon: LucideIcon; name: string; open: string; pct: number; hideConversation: boolean }
> = {
  graph: { icon: GraphStarIcon, name: 'Knowledge graph', open: 'Explore graph', pct: 60, hideConversation: false },
  form: { icon: ClipboardPenIcon, name: 'Form', open: 'Edit form', pct: 40, hideConversation: false },
}
export type ToolKind = keyof typeof TOOLS

// the conversation keeps at least this, and the tool view too (px)
export const MIN_CONVERSATION = 360
export const MIN_TOOL = 320
