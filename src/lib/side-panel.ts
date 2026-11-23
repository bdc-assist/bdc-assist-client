import type { ToolMessage } from '@/components/bdc/tool-view'
import { setForms, type FormDef, type FormValues } from '@/lib/forms'

// bdc-side-panel: the forms it can draft, and its drafting turns (its README's API section). Unset: no form prefill.
export const SIDE_PANEL_URL: string | undefined = import.meta.env.VITE_SIDE_PANEL_URL || undefined

/** bdc-side-panel answered 503: every slot is taken. */
export class Busy extends Error {
  constructor() {
    super('bdc-side-panel is busy')
  }
}

type Options = { url?: string; fetchImpl?: typeof fetch }

/** Loads the forms bdc-side-panel lists. Down or not ready: no forms, so no form cards or Get help button. */
export async function loadForms(url = SIDE_PANEL_URL, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    const resp = await fetchImpl(`${url}/tools`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    setForms(((await resp.json()) as { form: FormDef[] }).form)
  } catch (err) {
    console.warn(`bdc-side-panel at ${url} listed no forms: no form prefill`, err)
  }
}

async function post<T>(formId: string, route: 'open' | 'chat', body: object, opts: Options): Promise<T> {
  const { url = SIDE_PANEL_URL, fetchImpl = fetch } = opts
  const resp = await fetchImpl(`${url}/tools/form/${encodeURIComponent(formId)}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (resp.status === 503 && ((await resp.json().catch(() => null)) as { busy?: boolean } | null)?.busy) throw new Busy()
  if (!resp.ok) throw new Error(`bdc-side-panel ${route} failed (HTTP ${resp.status})`)
  return (await resp.json()) as T
}

export type MainMessage = { role: 'user' | 'assistant'; content: string }

/** The first draft, from the main chat up to the answer that offered the form, and that answer's question. */
export const openDraft = (formId: string, body: { history: MainMessage[]; question: string | null }, opts: Options = {}) =>
  post<{ summary: string; values: FormValues; reply: string; blocked: boolean }>(formId, 'open', body, opts)

/** A revision, from the panel chat. `values` and `edited` must hold no personal fields (withoutPersonal). */
export const reviseDraft = (
  formId: string,
  body: { values: FormValues; edited: string[]; messages: ToolMessage[]; summary: string; question: string | null },
  opts: Options = {},
) => post<{ values: FormValues; reply: string; blocked: boolean }>(formId, 'chat', body, opts)
