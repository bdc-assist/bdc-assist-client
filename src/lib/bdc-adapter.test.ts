import type { ChatModelRunOptions, ChatModelRunResult, ThreadMessage } from '@assistant-ui/react'
import { describe, expect, it, vi } from 'vitest'

import {
  BLOCKED_PART,
  createBdcAdapter,
  DRAFT_PART,
  FOLLOWUPS_PART,
  GRAPH_PART,
  REJECTED_PART,
  SOURCES_PART,
  STATUS_PART,
  toRequest,
  UNAVAILABLE_PART,
  type Reveal,
} from '@/lib/bdc-adapter'
import { streamOf } from '@/lib/test-utils'

const msg = (role: 'user' | 'assistant', text: string) =>
  ({ role, content: [{ type: 'text', text }] }) as unknown as ThreadMessage

const sse = (...events: object[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`)

const done = (over: object = {}) => ({
  type: 'done',
  answer: 'Final answer.',
  blocked: null,
  topics: [],
  followups: ['What is dbGaP?'],
  tool_results: [{ tool: 'search_docs' }],
  sources: { 'bdc-doc': [{ title: 'Overview', link: 'https://x/overview', type: 'page' }] },
  sources_md: '- [Overview](https://x/overview)',
  ...over,
})

/** Runs the adapter against a canned response; returns every yield. */
async function run(
  chunks: string[],
  opts: { status?: number; signal?: AbortSignal; reveal?: Reveal } = {},
) {
  const fetchImpl = vi.fn(async () => new Response(streamOf(chunks), { status: opts.status ?? 200 }))
  const adapter = createBdcAdapter('http://api', {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    reveal: opts.reveal,
  })
  const yields: ChatModelRunResult[] = []
  const gen = adapter.run({
    messages: [msg('user', 'What is BDC?')],
    abortSignal: opts.signal ?? new AbortController().signal,
  } as unknown as ChatModelRunOptions) as AsyncGenerator<ChatModelRunResult>
  for await (const y of gen) yields.push(y)
  return { yields, fetchImpl }
}

const textOf = (y: ChatModelRunResult) => (y.content![0] as { text: string }).text
/** The data parts after the text, as { name, data }. */
const dataParts = (y: ChatModelRunResult) =>
  (y.content ?? []).slice(1).map((p) => p as { name: string; data: unknown })
/** One data part's data, or undefined when the message has none. */
const dataOf = (y: ChatModelRunResult, name: string) => dataParts(y).find((p) => p.name === name)?.data

describe('toRequest', () => {
  it('sends the last user message as input and earlier turns as history', () => {
    const req = toRequest([msg('user', 'q1'), msg('assistant', 'a1'), msg('user', 'q2')])
    expect(req).toEqual({
      input: 'q2',
      chat_history: [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
      ],
    })
  })

  it('drops empty turns (e.g. a cancelled reply)', () => {
    const req = toRequest([msg('user', 'q1'), msg('assistant', ''), msg('user', 'q2')])
    expect(req.chat_history).toEqual([{ role: 'user', content: 'q1' }])
  })
})

describe('createBdcAdapter', () => {
  it('POSTs to /chat/stream', async () => {
    const { fetchImpl } = await run(sse(done()))
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api/chat/stream')
    expect(JSON.parse(init.body as string)).toEqual({ input: 'What is BDC?', chat_history: [] })
  })

  it('streams tokens, tracks node and status, then finishes on done', async () => {
    const { yields } = await run(
      sse(
        { type: 'node', node: 'agent' },
        { type: 'status', text: 'calling search_docs' },
        { type: 'token', text: 'BDC ' },
        { type: 'token', text: 'is' },
        done({ answer: 'BDC is.' }),
      ),
    )
    expect(yields.map(textOf)).toEqual(['', '', 'BDC ', 'BDC is', 'BDC is.'])
    expect(dataOf(yields[0], STATUS_PART)).toEqual({ node: 'agent', status: null })
    expect(dataOf(yields[1], STATUS_PART)).toEqual({ node: 'agent', status: 'calling search_docs' })
    // tokens don't clear it
    expect(dataOf(yields[2], STATUS_PART)).toEqual({ node: 'agent', status: 'calling search_docs' })
    expect(dataParts(yields.at(-1)!)).toEqual([
      { type: 'data', name: SOURCES_PART, data: { 'bdc-doc': [{ title: 'Overview', link: 'https://x/overview', type: 'page' }] } },
      { type: 'data', name: FOLLOWUPS_PART, data: ['What is dbGaP?'] },
    ])
  })

  it('discards streamed text and the tool status on reset', async () => {
    const { yields } = await run(
      sse(
        { type: 'status', text: 'calling search_docs' },
        { type: 'token', text: 'Let me look that up.' },
        { type: 'reset' },
        { type: 'token', text: 'BDC' },
        done(),
      ),
    )
    expect(yields.map(textOf).slice(1, 4)).toEqual(['Let me look that up.', '', 'BDC'])
    expect(dataOf(yields[1], STATUS_PART)).toEqual({ node: null, status: 'calling search_docs' })
    expect(dataOf(yields[2], STATUS_PART)).toBeUndefined()
  })

  it('shows sources as soon as the agent reports them', async () => {
    const sources = { 'bdc-doc': [{ title: 'A', link: 'https://a', type: 'faq' }] }
    const { yields } = await run(sse({ type: 'sources', sources, sources_md: '- A' }, done()))
    expect(dataOf(yields[0], SOURCES_PART)).toEqual(sources)
    expect(dataOf(yields[0], FOLLOWUPS_PART)).toBeUndefined() // not done yet
  })

  it('lets done override streamed text and sources (rejected answer)', async () => {
    const { yields } = await run(
      sse(
        { type: 'token', text: 'a dubious answer' },
        { type: 'sources', sources: { 'bdc-doc': [{ title: 'A', link: 'https://a', type: 'faq' }] }, sources_md: '- A' },
        done({ answer: 'Sorry, I can only help with BDC.', blocked: 'output', sources: {}, sources_md: '', followups: [] }),
      ),
    )
    const last = yields.at(-1)!
    expect(textOf(last)).toBe('Sorry, I can only help with BDC.')
    expect(dataOf(last, SOURCES_PART)).toBeUndefined()
    expect(dataOf(last, REJECTED_PART)).toEqual({})
  })

  // the API's kg: one graph per tool call (merged by fromKgList)
  const kg = [
    {
      tool: 'get_concept_graph',
      nodes: [
        { id: 'MONDO:1', name: 'chd', category: 'NamedThing' },
        { id: 'phv1', name: 'FC219', category: 'StudyVariable' },
      ],
      edges: [{ subject: 'phv1', object: 'MONDO:1' }],
    },
  ]
  const graph = {
    nodes: [
      { id: 'MONDO:1', label: 'chd', type: 'concept', concept_type: 'NamedThing' },
      { id: 'phv1', label: 'FC219', type: 'variable' },
    ],
    edges: [{ source: 'phv1', target: 'MONDO:1' }],
  }

  it('keeps the graph from the sources event, and lets done override it', async () => {
    const sources = { type: 'sources', sources: {}, sources_md: '', kg }
    const kept = await run(sse(sources, done({ kg })))
    expect(dataOf(kept.yields[0], GRAPH_PART)).toEqual({ graph, parts: [] })
    expect(dataOf(kept.yields.at(-1)!, GRAPH_PART)).toEqual({ graph, parts: [] })
    // rejected answer: done sends [] — the streamed graph goes too
    const rejected = await run(sse(sources, done({ kg: [] })))
    expect(dataOf(rejected.yields.at(-1)!, GRAPH_PART)).toBeUndefined()
  })

  it('has no graph without one', async () => {
    const { yields } = await run(sse(done()))
    expect(dataOf(yields[0], GRAPH_PART)).toBeUndefined()
  })

  it('reports a failed run as an error, not a lost connection', async () => {
    await expect(run(sse({ type: 'token', text: 'half an' }, { type: 'error' }))).rejects.toThrow(
      'BDC Assist ran into a problem answering. Please try again.',
    )
  })

  it('keeps the names of unavailable MCP servers, and notes them', async () => {
    const { yields } = await run(sse(done({ mcp_errors: ["dug_mcp: HTTPStatusError: Client error '403 Forbidden'"] })))
    expect(dataOf(yields[0], UNAVAILABLE_PART)).toEqual(['dug_mcp'])
  })

  it('marks blocked replies', async () => {
    const { yields } = await run(sse(done({ blocked: 'input' })))
    expect(dataOf(yields[0], BLOCKED_PART)).toEqual({})
  })

  it('never keeps tool_results', async () => {
    const { yields } = await run(sse(done()))
    expect(JSON.stringify(yields)).not.toContain('tool_results')
  })

  it('ignores unknown event types', async () => {
    const { yields } = await run(sse({ type: 'mystery' }, done()))
    expect(yields).toHaveLength(1)
  })

  it('throws on an HTTP error', async () => {
    await expect(run([], { status: 500 })).rejects.toThrow('HTTP 500')
  })

  it('throws if the stream ends without done', async () => {
    await expect(run(sse({ type: 'token', text: 'half' }))).rejects.toThrow('stopped before finishing')
  })

  it('returns quietly when the user cancels', async () => {
    const ctl = new AbortController()
    const fetchImpl = vi.fn(async () => {
      ctl.abort()
      throw new DOMException('aborted', 'AbortError')
    })
    const adapter = createBdcAdapter('http://api', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const gen = adapter.run({
      messages: [msg('user', 'q')],
      abortSignal: ctl.signal,
    } as unknown as ChatModelRunOptions) as AsyncGenerator<ChatModelRunResult>
    const yields = []
    for await (const y of gen) yields.push(y)
    expect(yields).toEqual([])
  })
})

describe('data parts', () => {
  const partsOf = (y: ChatModelRunResult) =>
    (y.content ?? []).slice(1).map((p) => (p as { name: string; data: unknown }))
  const names = (y: ChatModelRunResult) => partsOf(y).map((p) => p.name)

  it('keeps the text part first', async () => {
    const { yields } = await run(sse({ type: 'node', node: 'agent' }, done({ blocked: 'input' })))
    for (const y of yields) expect(y.content?.[0].type).toBe('text')
  })

  it('shows the node label until tokens flow, and the tool status until reset', async () => {
    const { yields } = await run(
      sse(
        { type: 'node', node: 'agent' },
        { type: 'status', text: 'calling search_docs' },
        { type: 'token', text: 'Let me look that up.' },
        { type: 'reset' },
        { type: 'token', text: 'BDC' },
        { type: 'node', node: 'output_guardrail' },
        done(),
      ),
    )
    const statusOf = (y: ChatModelRunResult) => partsOf(y).find((p) => p.name === STATUS_PART)?.data
    expect(partsOf(yields[0])).toEqual([{ type: 'data', name: STATUS_PART, data: { node: 'agent', status: null } }])
    expect(statusOf(yields[1])).toEqual({ node: 'agent', status: 'calling search_docs' })
    expect(statusOf(yields[2])).toEqual({ node: 'agent', status: 'calling search_docs' }) // tool still running
    expect(statusOf(yields[3])).toEqual({ node: 'agent', status: null }) // reset: "Thinking…"
    expect(names(yields[4])).toEqual([]) // answer streaming
    expect(statusOf(yields[5])).toEqual({ node: 'output_guardrail', status: null })
    expect(names(yields[6])).not.toContain(STATUS_PART) // done
  })

  it('adds sources once known, and none for empty sources', async () => {
    const { yields } = await run(sse(done({ followups: [] })))
    expect(names(yields[0])).toEqual([SOURCES_PART])
    const empty = await run(sse(done({ sources: {}, followups: [] })))
    expect(names(empty.yields[0])).toEqual([])
    const emptyList = await run(sse(done({ sources: { 'bdc-doc': [] }, followups: [] })))
    expect(names(emptyList.yields[0])).toEqual([])
  })

  it('adds the graph once known, before the status line, and holds it back in after-check', async () => {
    const kg = [{ tool: 't', nodes: [{ id: 'C', name: 'c' }, { id: 'v', name: 'v', category: 'StudyVariable' }], edges: [{ subject: 'v', object: 'C' }] }]
    const events = sse({ type: 'sources', sources: {}, sources_md: '', kg }, { type: 'node', node: 'output_guardrail' }, done({ kg }))
    const stream = await run(events)
    expect(names(stream.yields[0])).toContain(GRAPH_PART)
    const running = names(stream.yields[1])
    expect(running.indexOf(GRAPH_PART)).toBeLessThan(running.indexOf(STATUS_PART))
    const held = await run(events, { reveal: 'after-check' })
    expect(names(held.yields[1])).not.toContain(GRAPH_PART)
    expect(names(held.yields.at(-1)!)).toContain(GRAPH_PART)
  })

  it('passes each call\'s graph along, labelled, only when there are several', async () => {
    const call = (concept: string) => ({
      tool: 'get_concept_graph',
      args: { concept_id: concept },
      nodes: [{ id: concept, name: concept.toLowerCase() }, { id: `v-${concept}`, name: 'v', category: 'StudyVariable' }],
      edges: [{ subject: `v-${concept}`, object: concept }],
    })
    const graphData = async (kg: object[]) => {
      const { yields } = await run(sse(done({ kg })))
      return partsOf(yields[0]).find((p) => p.name === GRAPH_PART)?.data as { parts: { label: string }[] }
    }
    expect((await graphData([call('ASTHMA')])).parts).toEqual([])
    expect((await graphData([call('ASTHMA'), call('COPD')])).parts.map((p) => p.label)).toEqual([
      'asthma concept graph',
      'copd concept graph',
    ])
  })

  it('adds the follow-ups last, once done', async () => {
    const { yields } = await run(sse({ type: 'node', node: 'agent' }, done({ followups: ['A?', 'B?'] })))
    expect(names(yields[0])).not.toContain(FOLLOWUPS_PART)
    const last = partsOf(yields.at(-1)!)
    expect(last.at(-1)).toEqual({ type: 'data', name: FOLLOWUPS_PART, data: ['A?', 'B?'] })
  })

  it('adds no follow-ups when there are none, or for a blocked question', async () => {
    expect(names((await run(sse(done({ followups: [] })))).yields[0])).not.toContain(FOLLOWUPS_PART)
    expect(names((await run(sse(done({ blocked: 'input' })))).yields[0])).not.toContain(FOLLOWUPS_PART)
  })

  it('adds the blocked notice', async () => {
    const { yields } = await run(sse(done({ blocked: 'input', sources: {} })))
    expect(names(yields[0])).toEqual([BLOCKED_PART])
  })

  it('never sends data parts as history', () => {
    const assistant = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'a1' },
        { type: 'data', name: SOURCES_PART, data: {} },
      ],
    } as unknown as ThreadMessage
    expect(toRequest([msg('user', 'q1'), assistant, msg('user', 'q2')]).chat_history[1]).toEqual({
      role: 'assistant',
      content: 'a1',
    })
  })
})

describe('rejection', () => {
  // the notes the final message carries: the rejected one shows in stream mode
  const finalNotes = async (...events: object[]) =>
    dataParts((await run(sse(...events))).yields.at(-1)!)
      .map((p) => p.name)
      .filter((n) => n === BLOCKED_PART || n === REJECTED_PART)

  it('is the output guardrail blocking the streamed draft', async () => {
    expect(await finalNotes({ type: 'token', text: 'a dubious answer' }, done({ answer: 'Sorry.', blocked: 'output' }))).toEqual([
      REJECTED_PART,
    ])
    // after-check mode can reject before any draft was shown: still a reject
    expect(await finalNotes(done({ answer: 'Sorry.', blocked: 'output' }))).toEqual([REJECTED_PART])
  })

  it('is not the input guardrail refusing the question', async () => {
    expect(await finalNotes(done({ answer: 'Refusal.', blocked: 'input' }))).toEqual([BLOCKED_PART])
  })

  it('is neither for an unblocked answer, even one that differs from the draft', async () => {
    // a disclaimer appended, or a canned reply: done replaces the text, but nothing was blocked
    expect(
      await finalNotes({ type: 'token', text: 'BDC is a platform.' }, done({ answer: 'BDC is a platform.\n\nDisclaimer.' })),
    ).toEqual([])
  })

  it('adds a note in stream mode only', async () => {
    const events = sse({ type: 'token', text: 'draft' }, done({ answer: 'Canned.', blocked: 'output' }))
    const names = (y: ChatModelRunResult) => (y.content ?? []).map((p) => (p as { name?: string }).name)
    expect(names((await run(events)).yields.at(-1)!)).toContain(REJECTED_PART)
    expect(names((await run(events, { reveal: 'after-check' })).yields.at(-1)!)).not.toContain(REJECTED_PART)
  })
})

describe("reveal: 'after-check'", () => {
  const events = sse(
    { type: 'node', node: 'agent' },
    { type: 'token', text: 'one two three ' },
    { type: 'sources', sources: { 'bdc-doc': [{ title: 'A', link: 'https://a', type: 'faq' }] }, sources_md: '- A' },
    { type: 'token', text: 'four' },
    done({ answer: 'one two three four', followups: [] }),
  )
  const partsOf = (y: ChatModelRunResult) =>
    (y.content ?? []).slice(1).map((p) => p as { name: string; data: unknown })

  it('holds the text back and shows a growing draft instead', async () => {
    const { yields } = await run(events, { reveal: 'after-check' })
    expect(yields.slice(0, 4).map(textOf)).toEqual(['', '', '', ''])
    expect(partsOf(yields[1]).find((p) => p.name === DRAFT_PART)?.data).toEqual({ words: 3 })
    expect(partsOf(yields[3]).find((p) => p.name === DRAFT_PART)?.data).toEqual({ words: 4 })
    expect(textOf(yields[4])).toBe('one two three four')
    expect(partsOf(yields[4]).map((p) => p.name)).toEqual([SOURCES_PART])
  })

  it('keeps the status while tokens flow, and holds sources until done', async () => {
    const { yields } = await run(events, { reveal: 'after-check' })
    expect(partsOf(yields[1]).map((p) => p.name)).toEqual([DRAFT_PART, STATUS_PART])
    expect(partsOf(yields[2]).map((p) => p.name)).not.toContain(SOURCES_PART)
  })

  it('stream mode shows the draft text instead, with sources as they come', async () => {
    const { yields } = await run(events)
    expect(textOf(yields[1])).toBe('one two three ')
    expect(partsOf(yields[1]).map((p) => p.name)).toEqual([])
    expect(partsOf(yields[2]).map((p) => p.name)).toEqual([SOURCES_PART])
    expect(partsOf(yields[4]).map((p) => p.name)).toEqual([SOURCES_PART])
  })
})

describe('errors', () => {
  it('explains an unreachable API', async () => {
    const adapter = createBdcAdapter('http://api', {
      fetchImpl: (async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof fetch,
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const gen = adapter.run({
      messages: [msg('user', 'q')],
      abortSignal: new AbortController().signal,
    } as unknown as ChatModelRunOptions) as AsyncGenerator<ChatModelRunResult>
    await expect(gen.next()).rejects.toThrow("Can't reach BDC Assist at http://api. Is the API running?")
  })
})
