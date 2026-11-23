import { afterEach, describe, expect, it, vi } from 'vitest'

import { currentForms, setForms, type FormDef } from '@/lib/forms'
import { Busy, loadForms, openDraft, reviseDraft } from '@/lib/side-panel'

const GH: FormDef = { id: 'get-help', title: 'Get Help', url: 'https://bdc/help/get-help/', fields: [] }

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

afterEach(() => setForms([]))

describe('loadForms', () => {
  it("stores bdc-side-panel's forms", async () => {
    const fetchImpl = vi.fn(() => json({ form: [GH] }))
    await loadForms('http://sp', fetchImpl as unknown as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledWith('http://sp/tools')
    expect(currentForms()).toEqual([GH])
  })

  it('leaves no forms when bdc-side-panel is down or not ready', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await loadForms('http://sp', (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch)
    expect(currentForms()).toEqual([])
    await loadForms('http://sp', (() => json({ detail: 'no forms loaded' }, 503)) as unknown as typeof fetch)
    expect(currentForms()).toEqual([])
  })
})

describe('drafting', () => {
  const opts = (fetchImpl: unknown) => ({ url: 'http://sp', fetchImpl: fetchImpl as typeof fetch })

  it('openDraft posts the history and question', async () => {
    const reply = { summary: 'S', values: { cf_subject: 'Login' }, reply: 'Here it is.', blocked: false }
    const fetchImpl = vi.fn((_url: string, _init: RequestInit) => json(reply))
    const body = { history: [{ role: 'user' as const, content: 'my login loops' }], question: 'Why?' }
    await expect(openDraft('get-help', body, opts(fetchImpl))).resolves.toEqual(reply)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://sp/tools/form/get-help/open')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(body)
  })

  it('reviseDraft posts the turn to the chat route', async () => {
    const fetchImpl = vi.fn((_url: string, _init: RequestInit) => json({ values: {}, reply: 'ok', blocked: false }))
    const body = {
      values: { cf_subject: 'S' },
      edited: ['cf_subject'],
      messages: [{ role: 'user' as const, text: 'shorter' }],
      summary: 'S',
      question: null,
    }
    await reviseDraft('get help', body, opts(fetchImpl))
    expect(fetchImpl.mock.calls[0][0]).toBe('http://sp/tools/form/get%20help/chat')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string)).toEqual(body)
  })

  it('a 503 is Busy, other failures plain errors', async () => {
    await expect(openDraft('get-help', { history: [], question: null }, opts(() => json({ busy: true }, 503)))).rejects.toBeInstanceOf(
      Busy,
    )
    const failed = openDraft('get-help', { history: [], question: null }, opts(() => json({ detail: 'x' }, 502)))
    await expect(failed).rejects.toThrow()
    await expect(failed).rejects.not.toBeInstanceOf(Busy)
  })
})
