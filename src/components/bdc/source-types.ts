import {
  BadgeCheckIcon,
  BookMarkedIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CircleHelpIcon,
  CirclePlayIcon,
  DatabaseIcon,
  FileTextIcon,
  GlobeIcon,
  NewspaperIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react'

import type { Source, Sources } from '@/lib/bdc-adapter'

// How the source row under an answer shows each source type (design/source-icons.html
// draws them all: keep the two in step).
// doc_type values come from bdc-doc-mcp's ingest (SOURCE_DOC_TYPES); dbgap-study from
// Dug (the studies behind a graph); publication from artie-mcp (papers that used BDC, cited
// or added by related_work: the server merges them, so all are "related"); predefined from
// bdc-assist itself (a canned answer or disclaimer it showed, from predefined_responses.yaml).
// `many`: the label for several.
export type SourceType = { label: string; many: string; Icon: LucideIcon }
export const SOURCE_TYPES: Record<string, SourceType> = {
  page: { label: 'BDC website', many: 'BDC website pages', Icon: GlobeIcon },
  docs: { label: 'Documentation', many: 'Documentation', Icon: BookOpenIcon },
  faq: { label: 'FAQ', many: 'FAQs', Icon: CircleHelpIcon },
  video: { label: 'Video', many: 'Videos', Icon: CirclePlayIcon },
  event: { label: 'Event', many: 'Events', Icon: CalendarDaysIcon },
  update: { label: 'Update', many: 'Updates', Icon: NewspaperIcon },
  fellow: { label: 'Fellow', many: 'Fellows', Icon: UserRoundIcon },
  'dbgap-study': { label: 'dbGaP study', many: 'dbGaP studies', Icon: DatabaseIcon },
  // approved wording, not a document: a badge, not a plain check (the copy button turns into one)
  predefined: { label: 'Predefined response', many: 'Predefined responses', Icon: BadgeCheckIcon },
  publication: { label: 'Related publication', many: 'Related publications', Icon: BookMarkedIcon },
}
export const OTHER_SOURCE: SourceType = { label: 'Source', many: 'Sources', Icon: FileTextIcon }

// shown last, at the right end of the row in this order (dbGaP rightmost), whatever
// order the server lists them in
const LAST_TYPES = ['publication', 'dbgap-study']
const lastRank = (type: string) => LAST_TYPES.indexOf(type) + 1 // 0: not a last type

/** An answer's sources by type, whatever key the server listed them under: each type
 * where its first source is, except LAST_TYPES, which go last in their own order. */
export function sourcesByType(sources: Sources): { key: string; type: SourceType; sources: Source[] }[] {
  const byType = new Map<string, Source[]>()
  for (const s of Object.values(sources).flat()) byType.set(s.type, [...(byType.get(s.type) ?? []), s])
  return [...byType]
    .sort(([a], [b]) => lastRank(a) - lastRank(b))
    .map(([key, list]) => ({ key, type: SOURCE_TYPES[key] ?? OTHER_SOURCE, sources: list }))
}
