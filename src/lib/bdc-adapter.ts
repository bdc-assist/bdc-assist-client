import type { ChatModelAdapter, ThreadMessage } from '@assistant-ui/react'

import { fromKgList, kgParts, type KgGraph, type KgPart } from '@/kg'
import { readSSE } from '@/lib/sse'

// Wire format of POST /chat/stream (bdc-assist: stream_chat in r_assist/api.py; its README's API section).
export type Source = { title: string; link: string; type: string }
export type Sources = Record<string, Source[]> // {"bdc-doc": [...]}, deduplicated
/** BDC site forms the answer offers to prefill in the side panel, and the question (contextualized) to draft from. */
export type FormOffer = { question: string; forms: { id: string; title: string; url: string }[] }

type StreamEvent =
  | { type: 'node'; node: string; label?: string } // label: the server config's text for the step (a node's label in project.yaml)
  | { type: 'status'; text: string }
  | { type: 'token'; text: string }
  | { type: 'reset' }
  | { type: 'sources'; sources: Sources; sources_md: string; kg?: unknown } // kg: see fromKgList
  | {
      type: 'done'
      answer: string
      blocked: 'input' | 'output' | null // which guardrail stopped it: question refused, or answer rejected
      topics: string[]
      followups: string[]
      sources: Sources
      sources_md: string
      kg?: unknown
      mcp_errors?: string[] // "server: error" per MCP server currently unavailable
      // related_work's papers ({"artie": [...]}): found after answering, so not among the sources (the
      // answer isn't based on them) and never one it cites; null when none, or on a reject; older servers omit it
      related?: Sources | null
      form_offer?: FormOffer | null // BDC config's form_offer node: forms to offer to prefill (bdc-side-panel)
    }
  | { type: 'error' } // the run failed; last event, no done

/** An answer's state while it streams; toContent turns it into the message's parts.
 * Not stored on the message: the parts carry everything that's drawn or saved. */
export type BdcMessageMeta = {
  node: string | null // graph node currently running; null once done
  label?: string // the server's text for that node, if it sent one
  status: string | null // latest tool-call status; cleared by reset and new nodes
  sources: Sources | null // null until the agent reports them
  graph: KgGraph | null // the knowledge graph (kg) merged; null when there is none (yet)
  graphParts: KgPart[] // the same per tool call, labelled, to show one on its own
  unavailable: string[] // MCP servers that were down, by name (from mcp_errors)
  followups: string[]
  related: Source[] // related papers (done's related), all keys in one list
  offer: FormOffer | null // forms the answer offers to prefill; null until done, or none
  blocked: boolean // input guardrail refused the question
  rejected: boolean // output guardrail replaced the streamed draft
  done: boolean
}

/** How the answer is shown before the server has checked it:
 * - 'stream': the draft streams in as written
 * - 'after-check': placeholder bars grow with the draft; the text appears at done */
export type Reveal = 'stream' | 'after-check'

// Names of the `data` message parts the adapter emits, one renderer each.
export const STATUS_PART = 'bdc-status'
export const SOURCES_PART = 'bdc-sources'
export const BLOCKED_PART = 'bdc-blocked'
export const DRAFT_PART = 'bdc-draft'
export const REJECTED_PART = 'bdc-rejected'
export const GRAPH_PART = 'bdc-graph' // data: GraphPartData

/** The graph part's data: the merged graph, and each call's graph when there are several. */
export type GraphPartData = { graph: KgGraph; parts: KgPart[] }
export const FOLLOWUPS_PART = 'bdc-followups' // data: string[]
export const UNAVAILABLE_PART = 'bdc-unavailable' // data: string[] (MCP server names)
export const RELATED_PART = 'bdc-related' // data: Source[]
export const FORM_PART = 'bdc-form' // data: FormPartData

/** The form part's data: a BDC site form the answer offers to fill in (lib/forms.ts), and the question its draft
 * starts from. Conversations saved before the offer came from the server have no question. */
export type FormPartData = { form: string; question?: string | null }

export type StatusPartData = { node: string | null; status: string | null; label?: string }
export type DraftPartData = { words: number }

type StreamState = {
  text: string // the draft while running; the final answer once done
  streaming: boolean // tokens arriving since the last node/status/reset
  meta: BdcMessageMeta
}

const data = (name: string, data: object) => ({ type: 'data' as const, name, data })

/** The message content for the current state: the text first, then data parts
 * for message-parts.tsx to draw. History only sends text parts; of the data
 * parts, only the form offers reach the server (toClientState). */
export function toContent({ text, streaming, meta }: StreamState, reveal: Reveal) {
  const hold = reveal === 'after-check' && !meta.done
  const parts = []
  parts.push({ type: 'text' as const, text: hold ? '' : text })
  if (hold && text) {
    parts.push(data(DRAFT_PART, { words: text.split(/\s+/).filter(Boolean).length } satisfies DraftPartData))
  }
  // before the status line, so the status stays at the bottom while later nodes run
  if (!hold && meta.graph) {
    const graphData: GraphPartData = { graph: meta.graph, parts: meta.graphParts.length > 1 ? meta.graphParts : [] }
    parts.push(data(GRAPH_PART, graphData))
  }
  // streamed tokens are the progress, so the node label steps aside for them;
  // with the text held back, the label stays
  if (meta.status || (meta.node && (hold || !streaming))) {
    parts.push(data(STATUS_PART, { node: meta.node, status: meta.status, label: meta.label } satisfies StatusPartData))
  }
  if (!hold && meta.sources && Object.values(meta.sources).some((s) => s.length)) {
    parts.push(data(SOURCES_PART, meta.sources))
  }
  // only worth saying if the user watched the draft stream in
  if (reveal === 'stream' && meta.rejected) parts.push(data(REJECTED_PART, {}))
  if (meta.blocked) parts.push(data(BLOCKED_PART, {}))
  if (meta.done && meta.unavailable.length) parts.push(data(UNAVAILABLE_PART, meta.unavailable))
  // forms the server offers to fill in (bdc-assist's BDC config: form_offer), one card each
  if (meta.done && !meta.blocked && meta.offer)
    for (const f of meta.offer.forms)
      parts.push(data(FORM_PART, { form: f.id, question: meta.offer.question } satisfies FormPartData))
  // the server sends neither for a blocked question; checked anyway, they'd make no sense there.
  // Related papers just before the follow-ups: background reading, with the next questions last
  if (meta.done && !meta.blocked && meta.related.length) parts.push(data(RELATED_PART, meta.related))
  if (meta.done && !meta.blocked && meta.followups.length) parts.push(data(FOLLOWUPS_PART, meta.followups))
  return parts
}

const textOf = (m: ThreadMessage) =>
  m.content
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')

/** The messages as the server's chat history: every text turn, empty ones dropped. */
export function toHistory(messages: readonly ThreadMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: textOf(m) }))
    .filter((m) => m.content)
}

/** What the client sends back about itself (the request's `client_state`), for bdc-assist's config nodes. Each key
 * is one node's, documented with it in bdc-assist's README; the server keeps nothing between requests.
 * - offered_forms (BDC config's form_offer): the forms earlier answers offered, in order, with the question each
 *   was offered for (null in conversations saved before the server sent it); one offered before is offered again
 *   only for a new request. The header menu's drafts are not offers, so not here. */
export type ClientState = { offered_forms?: { id: string; question: string | null }[] }

export function toClientState(messages: readonly ThreadMessage[]): ClientState {
  const offered_forms = messages
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => m.content)
    .filter((p) => p.type === 'data' && p.name === FORM_PART)
    .map((p) => {
      const { form, question } = (p as { data: FormPartData }).data
      return { id: form, question: question ?? null }
    })
  return offered_forms.length ? { offered_forms } : {}
}

/** The server is stateless: send the last user message as `input`, every earlier text turn as `chat_history`, and
 * what the client knows about itself as `client_state` (left out when there's nothing to say). */
export function toRequest(messages: readonly ThreadMessage[]) {
  const last = messages.at(-1)
  if (last?.role !== 'user') throw new Error('last message must be from the user')
  const earlier = messages.slice(0, -1)
  const client_state = toClientState(earlier)
  return {
    input: textOf(last),
    chat_history: toHistory(earlier),
    ...(Object.keys(client_state).length ? { client_state } : {}),
  }
}

export type BdcAdapterOptions = {
  reveal?: Reveal
  fetchImpl?: typeof fetch
}

export function createBdcAdapter(
  apiUrl: string,
  { reveal = 'stream', fetchImpl = fetch }: BdcAdapterOptions = {},
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const state: StreamState = {
        text: '',
        streaming: false,
        meta: {
          node: null,
          status: null,
          sources: null,
          graph: null,
          graphParts: [],
          unavailable: [],
          followups: [],
          related: [],
          offer: null,
          blocked: false,
          rejected: false,
          done: false,
        },
      }
      const { meta } = state
      let failed = false // the server sent {"type": "error"}
      // the runtime replaces the message with each yield, so always send it all
      const snapshot = () => ({ content: toContent(state, reveal) })

      let resp: Response
      try {
        resp = await fetchImpl(`${apiUrl}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toRequest(messages)),
          signal: abortSignal,
        })
      } catch (err) {
        if (abortSignal.aborted) return
        console.error('bdc-assist fetch failed', err)
        throw new Error(`Can't reach BDC Assist at ${apiUrl}. Is the API running?`)
      }
      if (!resp.ok || !resp.body) {
        throw new Error(`BDC Assist ran into a problem (HTTP ${resp.status}). Please try again.`)
      }

      try {
        for await (const data of readSSE(resp.body)) {
          const ev = data as StreamEvent
          switch (ev.type) {
            case 'node':
              state.streaming = false
              meta.node = ev.node
              meta.label = ev.label
              meta.status = null
              break
            case 'status':
              state.streaming = false
              meta.status = ev.text
              break
            case 'token':
              // the tool status stays: a model often says "Let me look that up"
              // in the same chunk as the tool call, then waits on the tool
              state.streaming = true
              state.text += ev.text
              break
            case 'reset':
              state.text = '' // new model turn: only the last response counts
              state.streaming = false
              meta.status = null // the tool finished
              break
            case 'sources':
              // agent finished: its sources and graphs, sent early. done may still
              // clear both (a reject); related papers come only with done
              meta.sources = ev.sources
              meta.graph = fromKgList(ev.kg)
              meta.graphParts = kgParts(ev.kg)
              break
            case 'done': {
              // authoritative: rejects, disclaimers and canned replies replace
              // the streamed text, a rejected answer has no sources or graph, and
              // related papers (related_work's, beside the sources) and form offers arrive here.
              // blocked says which guardrail stopped it: the input one refused the
              // question; the output one rejected the streamed draft (a reject)
              meta.rejected = ev.blocked === 'output'
              meta.blocked = ev.blocked === 'input'
              state.text = ev.answer
              meta.sources = ev.sources
              meta.graph = fromKgList(ev.kg)
              meta.graphParts = kgParts(ev.kg)
              meta.unavailable = [...new Set((ev.mcp_errors ?? []).map((e) => e.split(':')[0].trim()))]
              meta.followups = ev.followups
              meta.related = Object.values(ev.related ?? {}).flat()
              meta.offer = ev.form_offer ?? null
              meta.node = null
              meta.label = undefined
              meta.status = null
              meta.done = true
              break
            }
            case 'error':
              failed = true
              break
            default:
              continue // unknown event type: ignore, don't re-render
          }
          if (failed) break
          yield snapshot()
        }
      } catch (err) {
        if (abortSignal.aborted) return
        console.error('bdc-assist stream failed', err)
        throw new Error('Lost the connection to BDC Assist mid-answer. Please try again.')
      }
      if (failed) throw new Error('BDC Assist ran into a problem answering. Please try again.')
      if (!meta.done) throw new Error('BDC Assist stopped before finishing the answer. Please try again.')
    },
  }
}
