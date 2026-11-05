import { ExternalLinkIcon, LoaderIcon, Redo2Icon, Undo2Icon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { ToolCard, ToolChat, ToolViewFrame, useToolView, type ToolMessage } from '@/components/bdc/tool-view'
import { buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formUrl, shownFields, type FormDef, type FormField, type FormValues } from '@/lib/forms'
import { cn } from '@/lib/utils'

import { demoFirstDraft, demoFormSuggestion, demoRevise } from './demo-drafts'

// Form prefill (bdc-assist#64, design/form-prefill.html), ?tools=demo only: an answer citing a form's page
// offers to fill it in: the form's card, whose open button drafts it in the tool view. Nothing is added to the
// conversation, and the card then shows the draft (always as it is now). The draft is refined in the
// tool: by its chat, or by clicking a value and typing. Open form goes to the BDC page with the values as URL
// parameters, where the user still checks and submits. Drafting and the chat's changes are canned
// (demo-drafts.ts); state is in memory.

// one state of the draft: its values, which fields the agent's last change touched, and which the user edited
type Draft = { values: FormValues; changed: string[]; edited: string[] }

export function FormPrefill({ form }: { form: FormDef }) {
  const tool = useToolView('form')
  const [stage, setStage] = useState<'offer' | 'drafting' | 'draft'>('offer')
  // Undo and Redo move `at`; a new change drops what was undone
  const [drafts, setDrafts] = useState<{ states: Draft[]; at: number }>({ states: [], at: -1 })
  const draft = drafts.states[drafts.at] ?? null
  const change = (next: Draft) =>
    setDrafts((d) => ({ states: [...d.states.slice(0, d.at + 1), next], at: d.at + 1 }))
  const [chat, setChat] = useState<ToolMessage[]>([])
  const [busy, setBusy] = useState(false)

  const prefill = async () => {
    setStage('drafting')
    tool.open()
    const first = await demoFirstDraft()
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
  const edited = Boolean(draft && drafts.states[0] && JSON.stringify(draft.values) !== JSON.stringify(drafts.states[0].values))
  // the card's and the tool header's summary line
  const summary = draft
    ? `${draft.values.ticket_type || 'No type chosen'} · ${draft.values.cf_subject || 'No subject'}`
    : null
  const frame = tool.isOpen && (
    <ToolViewFrame
      kind="form"
      name={form.title}
      summary={summary ?? undefined}
      edited={edited}
      onReset={() => drafts.states[0] && change(drafts.states[0])} // back to the first draft, undoably
      actions={
        <>
          <TooltipIconButton
            tooltip="Undo"
            side="bottom"
            className="size-7 p-1.5"
            disabled={drafts.at <= 0 || busy}
            onClick={() => setDrafts((d) => ({ ...d, at: d.at - 1 }))}
          >
            <Undo2Icon />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Redo"
            side="bottom"
            className="size-7 p-1.5"
            disabled={drafts.at >= drafts.states.length - 1 || busy}
            onClick={() => setDrafts((d) => ({ ...d, at: d.at + 1 }))}
          >
            <Redo2Icon />
          </TooltipIconButton>
          {draft && <OpenForm href={formUrl(form, draft.values)} />}
        </>
      }
    >
      <div className="@container min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {draft ? (
          <>
            <dl className="grid grid-cols-[minmax(8rem,max-content)_1fr] text-sm @max-sm:grid-cols-1">
              {shownFields(form, draft.values).map((f) => (
                <FieldRow key={`${drafts.at}-${f.name}`} field={f} draft={draft} onEdit={edit} />
              ))}
            </dl>
            <p className="text-muted-foreground mt-2 text-xs">
              Open form goes to the form on the BDC site with these values. You can change anything there before you
              submit. Click a value to edit it, or ask for changes below.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <LoaderIcon className="size-4 animate-spin" />
            Drafting the {form.title}…
          </p>
        )}
      </div>
      <ToolChat
        what="draft"
        messages={chat}
        suggestion={draft && demoFormSuggestion(draft.values)}
        busy={busy || stage === 'drafting'}
        onSend={(t) => void send(t)}
      />
    </ToolViewFrame>
  )

  // the offer is the same card, before there's a draft: opening it drafts the form in the tool view
  if (stage === 'offer')
    return (
      <ToolCard
        kind="form"
        name={form.title}
        summary="bdc-assist can fill this in from the conversation. Open it in the side panel to start."
        isOpen={false}
        onOpen={() => void prefill()}
      />
    )

  // the draft's card (the card every tool's object has): the draft as it is now
  return (
    <>
      <ToolCard
        kind="form"
        name={form.title}
        summary={summary}
        edited={edited}
        status={
          stage === 'drafting' && (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <LoaderIcon className="size-3.5 animate-spin" />
              Drafting…
            </span>
          )
        }
        isOpen={tool.isOpen}
        onOpen={tool.open}
      />
      {frame}
    </>
  )
}

// Open form in the tool's header; on a narrow tool view just its icon (the header is a container)
function OpenForm({ href }: { href: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={href} target="_blank" rel="noopener" className={cn(buttonVariants({ size: 'sm' }), 'mx-0.5')}>
          <span className="@max-md:sr-only">Open form</span>
          <ExternalLinkIcon />
        </a>
      </TooltipTrigger>
      <TooltipContent side="bottom">Open form on the BDC site</TooltipContent>
    </Tooltip>
  )
}

const TAGS = {
  updated: 'bg-blue-50 text-blue-700 dark:bg-blue-300/10 dark:text-blue-300',
  edited: 'bg-muted text-muted-foreground',
  needed: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
}

function Tag({ kind }: { kind: keyof typeof TAGS }) {
  return <span className={cn('shrink-0 rounded-full px-1.5 text-[11px] leading-[18px]', TAGS[kind])}>{kind}</span>
}

// a field's label and value. Text values edit in place (Enter or leaving the field keeps the edit, Escape drops
// it); dropdowns edit as dropdowns; consent is done on the form. Keyed by the draft state, so Undo resets it
function FieldRow({ field: f, draft, onEdit }: { field: FormField; draft: Draft; onEdit: (name: string, v: string) => void }) {
  const value = draft.values[f.name] ?? ''
  const tag = draft.edited.includes(f.name) ? (
    <Tag kind="edited" />
  ) : draft.changed.includes(f.name) ? (
    <Tag kind="updated" />
  ) : !value && f.required && !f.personal && !f.confirm ? (
    <Tag kind="needed" />
  ) : null
  const empty = f.personal ? 'Left for you to fill in' : f.required ? 'Not filled in yet' : 'Optional, left blank'
  let control: ReactNode
  if (f.confirm) control = <span className="text-muted-foreground px-1 italic">You tick this on the form</span>
  else if (f.choices)
    control = (
      <select
        value={value}
        onChange={(e) => onEdit(f.name, e.target.value)}
        className={cn(
          'hover:bg-muted focus:bg-muted -mx-1 max-w-full min-w-0 rounded bg-transparent px-1 outline-none',
          !value && 'text-muted-foreground italic',
        )}
      >
        <option value="">{f.required ? 'Not chosen yet' : 'Optional, left blank'}</option>
        {f.choices.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    )
  else
    control = (
      <textarea
        rows={1}
        defaultValue={value}
        placeholder={empty}
        aria-label={f.label}
        onBlur={(e) => onEdit(f.name, e.target.value.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            e.currentTarget.value = value
            e.currentTarget.blur()
          }
        }}
        className="hover:bg-muted focus:bg-muted placeholder:text-muted-foreground -mx-1 field-sizing-content min-w-0 flex-1 cursor-text resize-none rounded bg-transparent px-1 outline-none placeholder:italic"
      />
    )
  return (
    <>
      <dt className="text-muted-foreground border-b py-1.5 pr-3 @max-sm:border-0 @max-sm:pb-0">
        {f.label}
        {f.required && <span className="text-destructive"> *</span>}
      </dt>
      <dd className="flex min-w-0 items-start gap-2 border-b py-1.5">
        {control}
        {tag}
      </dd>
    </>
  )
}
