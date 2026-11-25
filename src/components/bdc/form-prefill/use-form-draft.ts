import { useState } from 'react'

import { useToolView, type ToolMessage } from '@/components/bdc/tool-view'
import { draftSummary, mergeReply, withoutPersonal, type FormDef, type FormValues } from '@/lib/forms'
import { Busy, openDraft, reviseDraft, type MainMessage } from '@/lib/side-panel'

// one state of the draft: its values, which fields the agent's last change touched, and which the user edited
export type Draft = { values: FormValues; changed: string[]; edited: string[] }

// what every later turn carries instead of the main chat: its summary (from the first draft) and the question
export type DraftContext = { summary: string; question: string | null }

const personal = (form: FormDef, name: string) => form.fields.some((f) => f.name === name && f.personal)

/** A turn's request: the draft without personal values or names (those stay in the browser). */
export const chatBody = (form: FormDef, draft: Draft, messages: ToolMessage[], context: DraftContext) => ({
  values: withoutPersonal(form, draft.values),
  edited: draft.edited.filter((n) => !personal(form, n)),
  messages,
  summary: context.summary,
  question: context.question,
})

/** The panel chat's line when bdc-side-panel can't help: busy, or failed. The fields still work by hand. */
export function failureText(err: unknown, first: boolean): string {
  const what = err instanceof Busy ? 'The form helper is busy right now.' : "The form helper couldn't do that."
  return first ? `${what} Fill in the fields yourself, or ask again below.` : `${what} Please try again in a moment.`
}

/** One draft of a form and its tool: whoever owns it (an answer's card, the header's form menu) shows its
 * own way in, and FormDraftTool while it's open. bdc-side-panel drafts it (lib/side-panel.ts); personal fields
 * are the user's alone. State is in memory. */
export function useFormDraft(form: FormDef) {
  const tool = useToolView('form')
  const [stage, setStage] = useState<'none' | 'drafting' | 'draft'>('none')
  // Undo and Redo move `at`; a new change drops what was undone
  const [drafts, setDrafts] = useState<{ states: Draft[]; at: number }>({ states: [], at: -1 })
  const draft = drafts.states[drafts.at] ?? null
  const change = (next: Draft) =>
    setDrafts((d) => ({ states: [...d.states.slice(0, d.at + 1), next], at: d.at + 1 }))
  const [chat, setChat] = useState<ToolMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [context, setContext] = useState<DraftContext>({ summary: '', question: null })

  /** Opens the tool and makes the first draft from the main chat (history) and the question it was offered for. */
  const prefill = async (start: { history: MainMessage[]; question: string | null }) => {
    setStage('drafting')
    tool.open()
    try {
      const first = await openDraft(form.id, start)
      setContext({ summary: first.summary, question: start.question })
      change({ values: first.values, changed: [], edited: [] })
      setChat([{ role: 'tool', text: first.reply }])
    } catch (err) {
      console.error('bdc-side-panel open failed', err)
      setContext({ summary: '', question: start.question })
      change({ values: {}, changed: [], edited: [] })
      setChat([{ role: 'tool', text: failureText(err, true) }])
    }
    setStage('draft')
  }
  const send = async (text: string) => {
    if (!draft) return
    const messages: ToolMessage[] = [...chat, { role: 'user', text }]
    setChat(messages)
    setBusy(true)
    try {
      const result = await reviseDraft(form.id, chatBody(form, draft, messages, context))
      // applied to the draft as it is now, not as it was sent: its personal values are the user's latest
      setDrafts((d) => {
        const now = d.states[d.at]
        const values = mergeReply(form, now.values, result.values)
        const changed = Object.keys({ ...now.values, ...values }).filter((k) => (values[k] ?? '') !== (now.values[k] ?? ''))
        if (!changed.length) return d
        const next = { values, changed, edited: now.edited.filter((k) => !changed.includes(k)) }
        return { states: [...d.states.slice(0, d.at + 1), next], at: d.at + 1 }
      })
      setChat((c) => [...c, { role: 'tool', text: result.reply }])
    } catch (err) {
      console.error('bdc-side-panel chat failed', err)
      setChat((c) => [...c, { role: 'tool', text: failureText(err, false) }])
    }
    setBusy(false)
  }
  const edit = (name: string, value: string) => {
    if (!draft || value === (draft.values[name] ?? '')) return
    change({
      values: { ...draft.values, [name]: value },
      changed: draft.changed.filter((k) => k !== name),
      edited: [...new Set([...draft.edited, name])],
    })
  }

  // changed since the first draft (the agent's), by chat or by hand; Reset goes back to it
  const first = drafts.states[0]
  const edited = Boolean(draft && first && JSON.stringify(draft.values) !== JSON.stringify(first.values))
  return {
    tool,
    stage,
    draft,
    chat,
    busy,
    edited,
    summary: draft ? (draftSummary(form, draft.values) ?? 'Nothing filled in yet') : null, // the card's and header's line
    prefill,
    send,
    edit,
    reset: () => first && change(first), // back to the first draft, undoably
    canUndo: drafts.at > 0 && !busy,
    canRedo: drafts.at < drafts.states.length - 1 && !busy,
    undo: () => setDrafts((d) => ({ ...d, at: d.at - 1 })),
    redo: () => setDrafts((d) => ({ ...d, at: d.at + 1 })),
  }
}

export type FormDraftState = ReturnType<typeof useFormDraft>
