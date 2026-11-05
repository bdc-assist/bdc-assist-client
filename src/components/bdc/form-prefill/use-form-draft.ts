import { useState } from 'react'

import { useToolView, type ToolMessage } from '@/components/bdc/tool-view'
import type { FormValues } from '@/lib/forms'

import { demoFirstDraft, demoRevise } from './demo-drafts'

// one state of the draft: its values, which fields the agent's last change touched, and which the user edited
export type Draft = { values: FormValues; changed: string[]; edited: string[] }

/** One draft of a form and its tool: whoever owns it (an answer's card, the header's Get help button) shows its
 * own way in, and FormDraftTool while it's open. Drafting and the chat's changes are canned (demo-drafts.ts);
 * state is in memory. */
export function useFormDraft() {
  const tool = useToolView('form')
  const [stage, setStage] = useState<'none' | 'drafting' | 'draft'>('none')
  // Undo and Redo move `at`; a new change drops what was undone
  const [drafts, setDrafts] = useState<{ states: Draft[]; at: number }>({ states: [], at: -1 })
  const draft = drafts.states[drafts.at] ?? null
  const change = (next: Draft) =>
    setDrafts((d) => ({ states: [...d.states.slice(0, d.at + 1), next], at: d.at + 1 }))
  const [chat, setChat] = useState<ToolMessage[]>([])
  const [busy, setBusy] = useState(false)

  /** Opens the tool and makes the first draft: from the conversation, or `blank` when there's nothing to go on. */
  const prefill = async (blank = false) => {
    setStage('drafting')
    tool.open()
    const first = await demoFirstDraft(blank)
    change({ values: first.values, changed: [], edited: [] })
    setChat([{ role: 'tool', text: first.reply }])
    setStage('draft')
  }
  const send = async (text: string) => {
    if (!draft) return
    setChat((c) => [...c, { role: 'user', text }])
    setBusy(true)
    const result = await demoRevise(text, draft.values, draft.edited)
    const changed = Object.keys({ ...draft.values, ...result.values }).filter(
      (k) => (result.values[k] ?? '') !== (draft.values[k] ?? ''),
    )
    if (changed.length) change({ values: result.values, changed, edited: draft.edited.filter((k) => !changed.includes(k)) })
    setChat((c) => [...c, { role: 'tool', text: result.reply }])
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
  // the card's and the tool header's summary line
  const summary = draft
    ? `${draft.values.ticket_type || 'No type chosen'} · ${draft.values.cf_subject || 'No subject'}`
    : null
  return {
    tool,
    stage,
    draft,
    at: drafts.at, // which state is shown: keys the fields, so Undo resets them
    chat,
    busy,
    edited,
    summary,
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
