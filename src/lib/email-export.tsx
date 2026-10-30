import type { CSSProperties, ElementType, HTMLAttributes } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { drawnGraph, NO_STUDY_LABEL, studyList, type KgGraph } from '@/kg'
import { BLOCKED_PART, GRAPH_PART, UNAVAILABLE_PART, type GraphPartData } from '@/lib/bdc-adapter'

// "Copy for email" (design/email-export.html): a conversation, or one question and answer, as
// an email to paste: HTML for the mail client, plain text for those that only take text.
// Inline styles only (mail clients drop stylesheets), and no text, background or link colours:
// dark-mode clients darken the background but keep a colour that's set, so the client picks
// them. Greys are a mid grey that reads on white and on dark. Sources, status lines and
// follow-ups are left out.

/** A message part, as stored on the message (text, or one of bdc-adapter's data parts). */
export type AnswerPart = { readonly type: string; readonly text?: string; readonly name?: string; readonly data?: unknown }

/** One question and its answer. `ended`: the answer was stopped, or failed, part way. */
export type EmailTurn = { question: string; answer: readonly AnswerPart[]; ended?: 'stopped' | 'failed' }

/** How a graph goes into the email: a picture of the view it shows (Force, Radial, Flow),
 * or for List a table of its studies. */
export type EmailGraph = { image: { src: string; width: number; height: number }; view: string } | { table: true }

export type EmailOptions = {
  title: string // the conversation's
  date: Date
  /** Include the graphs; false: a line saying one was there. */
  graphs: boolean
  /** Each graph, in order through the turns; null or missing: a line saying one was there. */
  graph?: (data: GraphPartData, index: number) => EmailGraph | null | undefined
}

export type Email = { subject: string; html: string; text: string }

/** A thread message, as much of it as an email needs. */
export type EmailMessage = {
  readonly id: string
  readonly role: string
  readonly content: readonly AnswerPart[]
  readonly status?: { readonly type: string; readonly reason?: string }
}

/** The turns to send: every answer with the question before it ('full'), or only the
 * answer `answerId` ('single'). */
export function turnsOf(messages: readonly EmailMessage[], scope: 'single' | 'full', answerId: string): EmailTurn[] {
  const turns: EmailTurn[] = []
  let question = ''
  for (const m of messages) {
    if (m.role === 'user') question = textOf(m.content)
    if (m.role !== 'assistant' || (scope === 'single' && m.id !== answerId)) continue
    const reason = m.status?.type === 'incomplete' ? m.status.reason : undefined
    const ended = reason === 'cancelled' ? 'stopped' : reason === 'error' ? 'failed' : undefined
    turns.push({ question, answer: m.content, ...(ended && { ended }) })
  }
  return turns
}

/** The graphs `turns` hold (each graph part's merged graph), in order. */
export const graphsOf = (turns: readonly EmailTurn[]): KgGraph[] =>
  turns.flatMap((t) => dataOf(t.answer, GRAPH_PART).map((p) => graphData(p.data).graph))

/** How many graphs `turns` hold. */
export const graphCount = (turns: readonly EmailTurn[]) => graphsOf(turns).length

const GREY = '#8a8a8a'
const IMAGE_WIDTH = 640 // at most: the image itself is drawn at 2x for sharpness

const S = {
  wrap: { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 14, lineHeight: 1.5, maxWidth: 680 },
  title: { fontSize: 16, fontWeight: 'bold', margin: '0 0 12px' },
  question: { margin: '16px 0 8px', padding: '2px 0 2px 12px', borderLeft: `3px solid ${GREY}`, whiteSpace: 'pre-wrap' },
  questionLabel: { display: 'block', fontSize: 12, color: GREY },
  p: { margin: '0 0 10px' },
  list: { margin: '0 0 10px', paddingLeft: 22 },
  heading: { fontSize: 15, fontWeight: 'bold', margin: '14px 0 6px' },
  quote: { margin: '0 0 10px', padding: '0 0 0 12px', borderLeft: `3px solid ${GREY}` },
  code: { fontFamily: 'Consolas, Menlo, monospace', fontSize: 13 },
  pre: { margin: '0 0 10px', padding: '8px 10px', border: `1px solid ${GREY}`, borderRadius: 4, whiteSpace: 'pre-wrap' },
  table: { borderCollapse: 'collapse', margin: '4px 0 12px', fontSize: 13 },
  cell: { border: `1px solid ${GREY}`, padding: '4px 8px', textAlign: 'left', verticalAlign: 'top' },
  image: { display: 'block', maxWidth: '100%', height: 'auto', border: `1px solid ${GREY}`, borderRadius: 6, margin: '4px 0 6px' },
  note: { fontSize: 12, color: GREY, margin: '0 0 12px' },
  footer: { marginTop: 20, paddingTop: 10, borderTop: `1px solid ${GREY}`, fontSize: 12, color: GREY },
} satisfies Record<string, CSSProperties>

// the answer's markdown, each element with its inline style (`node`: react-markdown's syntax
// tree node, not for the DOM)
const styled = (Tag: ElementType, style: CSSProperties) =>
  function Styled({ node, ...props }: HTMLAttributes<HTMLElement> & { node?: unknown }) {
    return <Tag {...props} style={style} />
  }
const MARKDOWN: Components = {
  p: styled('p', S.p),
  ul: styled('ul', S.list),
  ol: styled('ol', S.list),
  h1: styled('p', S.heading),
  h2: styled('p', S.heading),
  h3: styled('p', S.heading),
  h4: styled('p', S.heading),
  blockquote: styled('blockquote', S.quote),
  code: styled('code', S.code),
  pre: styled('pre', S.pre),
  table: styled('table', S.table),
  th: styled('th', S.cell),
  td: styled('td', S.cell),
}

/** What a graph shows, in a few words: "12 studies, 48 variables (asthma, COPD)". As drawn by
 * default (releases merged, synonyms grouped), so the numbers match the app. */
export function graphSummary(graph: KgGraph): string {
  const drawn = drawnGraph(graph)
  const count = (type: string) => drawn.nodes.filter((n) => n.type === type).length
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const counts = [plural(count('study'), 'study', 'studies'), plural(count('variable'), 'variable', 'variables')]
  const asked = drawn.nodes.filter((n) => n.seed).map((n) => n.label)
  return counts.join(', ') + (asked.length ? ` (${asked.join(', ')})` : '')
}

const viewName = (view: string) => view.charAt(0).toUpperCase() + view.slice(1)

function StudyTable({ graph }: { graph: KgGraph }) {
  return (
    <table style={{ ...S.table, margin: '4px 0 6px' }}>
      <thead>
        <tr>
          <th style={S.cell}>Study</th>
          <th style={S.cell}>Concepts</th>
          <th style={S.cell}>Variables</th>
        </tr>
      </thead>
      <tbody>
        {studyList(drawnGraph(graph)).map((s) => (
          <tr key={s.study?.id ?? ''}>
            <td style={S.cell}>
              {s.study?.label ?? NO_STUDY_LABEL}
              {s.study && <span style={{ display: 'block', color: GREY }}>{s.study.id}</span>}
            </td>
            <td style={S.cell}>{s.concepts.map((c) => c.label).join(', ')}</td>
            <td style={{ ...S.cell, textAlign: 'right' }}>{s.variables.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Graph({ data, embed }: { data: GraphPartData; embed: EmailGraph | null | undefined }) {
  const summary = graphSummary(data.graph)
  if (!embed) return <p style={S.note}>A knowledge graph of {summary} was shown here in BDC Assist.</p>
  if ('table' in embed) {
    // the caption under it, as under an image
    return (
      <>
        <StudyTable graph={data.graph} />
        <p style={S.note}>Knowledge graph (List view): {summary}</p>
      </>
    )
  }
  const { src, width, height } = embed.image
  const shown = Math.min(IMAGE_WIDTH, width)
  return (
    <>
      <img
        src={src}
        width={shown}
        height={Math.round((height * shown) / width)}
        alt={`Knowledge graph: ${summary}`}
        style={S.image}
      />
      <p style={S.note}>
        Knowledge graph ({viewName(embed.view)} view): {summary}
      </p>
    </>
  )
}

// short notes, as the app shows them under an answer
const ENDED = { stopped: 'Answer stopped', failed: 'Answer failed' }
const BLOCKED = 'Outside what BDC Assist can help with'
const UNAVAILABLE = 'Some data services were unavailable, so this answer may be incomplete'

const textOf = (parts: readonly AnswerPart[]) =>
  parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
const dataOf = (parts: readonly AnswerPart[], name: string) =>
  parts.filter((p) => p.type === 'data' && p.name === name)

// conversations saved before per-call graphs stored just the graph
const graphData = (data: unknown): GraphPartData =>
  'nodes' in (data as object) ? { graph: data as KgGraph, parts: [] } : (data as GraphPartData)

/** `turns` as an email (see the top of this file). */
export function toEmail(turns: readonly EmailTurn[], options: EmailOptions): Email {
  const subject = options.title ? `BDC Assist: ${options.title}` : 'BDC Assist'
  const date = options.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const footer = `Generated by BDC Assist on ${date}.`

  let graphIndex = 0
  const html = renderToStaticMarkup(
    <div style={S.wrap}>
      <p style={S.title}>{subject.replace(/^BDC Assist: /, 'BDC Assist · ')}</p>
      {turns.map((turn, i) => {
        const answer = textOf(turn.answer)
        const notes = [
          ...(turn.ended ? [ENDED[turn.ended]] : []),
          ...(dataOf(turn.answer, BLOCKED_PART).length ? [BLOCKED] : []),
          ...(dataOf(turn.answer, UNAVAILABLE_PART).length ? [UNAVAILABLE] : []),
        ]
        return (
          <div key={i}>
            <div style={S.question}>
              <span style={S.questionLabel}>Question</span>
              {turn.question}
            </div>
            {answer && (
              <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
                {answer}
              </Markdown>
            )}
            {dataOf(turn.answer, GRAPH_PART).map((part, j) => {
              const data = graphData(part.data)
              const index = graphIndex++
              return <Graph key={j} data={data} embed={options.graphs ? options.graph?.(data, index) : null} />
            })}
            {notes.map((note) => (
              <p key={note} style={S.note}>
                ({note})
              </p>
            ))}
          </div>
        )
      })}
      <p style={S.footer}>{footer}</p>
    </div>,
  )

  // plain text: the answer's markdown reads fine as it is
  const lines = [subject.replace(/^BDC Assist: /, 'BDC Assist · '), '']
  for (const turn of turns) {
    lines.push(`Question: ${turn.question}`, '')
    const answer = textOf(turn.answer).trim()
    if (answer) lines.push(answer, '')
    for (const part of dataOf(turn.answer, GRAPH_PART)) {
      lines.push(`[Knowledge graph: ${graphSummary(graphData(part.data).graph)}]`, '')
    }
    if (turn.ended) lines.push(`(${ENDED[turn.ended]})`, '')
    if (dataOf(turn.answer, BLOCKED_PART).length) lines.push(`(${BLOCKED})`, '')
    if (dataOf(turn.answer, UNAVAILABLE_PART).length) lines.push(`(${UNAVAILABLE})`, '')
  }
  lines.push(footer)

  return { subject, html, text: lines.join('\n') }
}
