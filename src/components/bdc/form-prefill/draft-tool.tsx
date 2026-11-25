import { ExternalLinkIcon, LoaderIcon, Redo2Icon, Undo2Icon } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { ToolViewFrame } from '@/components/bdc/tool-view'
import { buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formUrl, shownFields, type FormDef, type FormField } from '@/lib/forms'
import { cn } from '@/lib/utils'

import type { Draft, FormDraftState } from './use-form-draft'

/** A form draft in the tool view (`d` from useFormDraft): Undo/Redo in the header, a bar with Open on BDC, the fields
 * and its chat. Render it
 * only while the draft's tool is open. */
export function FormDraftTool({ form, d }: { form: FormDef; d: FormDraftState }) {
  const { draft } = d
  return (
    <ToolViewFrame
      kind="form"
      chat={{
        what: 'draft',
        messages: d.chat,
        busy: d.busy || d.stage === 'drafting',
        onSend: (t) => void d.send(t),
      }}
      name={form.title}
      summary={d.summary ?? undefined}
      edited={d.edited}
      onReset={() => !d.busy && d.reset()} // not while a reply is pending: it would land on top
      actions={
        <>
          <TooltipIconButton tooltip="Undo" side="bottom" className="size-7 p-1.5" disabled={!d.canUndo} onClick={d.undo}>
            <Undo2Icon />
          </TooltipIconButton>
          <TooltipIconButton tooltip="Redo" side="bottom" className="size-7 p-1.5" disabled={!d.canRedo} onClick={d.redo}>
            <Redo2Icon />
          </TooltipIconButton>
        </>
      }
    >
      <div className="@container flex min-h-0 flex-1 flex-col">
        {draft && (
          // a bar above the fields (design/form-layout.html, option B2): how the panel works, and the way out to BDC;
          // it stays put while the fields scroll. On a narrow sheet the button goes under the text
          <div className="bg-muted/50 flex shrink-0 items-center gap-3 border-b px-3 py-2 @max-sm:flex-col @max-sm:items-stretch">
            <p className="text-muted-foreground flex-1 text-xs">
              Click a value to edit it, or chat to make changes. Then Open on BDC for final submission.
            </p>
            <OpenOnBdc href={formUrl(form, draft.values)} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {draft ? (
            <FieldList form={form} draft={draft} onEdit={d.edit} busy={d.busy} />
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <LoaderIcon className="size-4 animate-spin" />
              Drafting the {form.title} form…
            </p>
          )}
        </div>
      </div>
    </ToolViewFrame>
  )
}

type FieldProps = { draft: Draft; onEdit: (name: string, v: string) => void; busy?: boolean }

/** The draft's shown fields, each editable in place; locked while a reply is pending (busy), which would otherwise
 * land on top of an edit made meanwhile. Labels take at most 40% of the width and wrap beyond it, so one long label
 * (cloud credits' HLBS question) doesn't squeeze every value (design/form-layout.html, option B). */
export function FieldList({ form, ...props }: FieldProps & { form: FormDef }) {
  return (
    <dl className="grid grid-cols-[fit-content(40%)_1fr] text-sm @max-sm:grid-cols-1">
      {shownFields(form, props.draft.values).map((f) => (
        <FieldRow key={f.name} field={f} {...props} />
      ))}
    </dl>
  )
}

// Open on BDC in the bar above the fields (not "Open form": the card's Edit form opens the draft), filled in the BDC
// red (design/form-prefill.html's Open button options)
function OpenOnBdc({ href }: { href: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={href} target="_blank" rel="noopener" className={cn(buttonVariants({ size: 'sm' }), 'bg-(--bdc-button) text-white hover:bg-(--bdc-button)/85')}>
          Open on BDC
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

// a field's label and value, edited in place by its kind. Text, numbers and dates keep an edit on Enter or on leaving
// the field (Escape drops it); dropdowns and checkboxes right away. Personal fields are the user's to fill. The
// typed-in controls are keyed by their value, so Undo, Reset and a reply reset them; rows aren't remounted, so
// dropdowns and checkboxes keep the keyboard focus
function FieldRow({ field: f, draft, onEdit, busy = false }: FieldProps & { field: FormField }) {
  const value = draft.values[f.name] ?? ''
  const tag = draft.edited.includes(f.name) ? (
    <Tag kind="edited" />
  ) : draft.changed.includes(f.name) ? (
    <Tag kind="updated" />
  ) : !value && f.required && !f.personal ? (
    <Tag kind="needed" />
  ) : null
  const empty = f.personal ? 'Left for you to fill in' : f.required ? 'Not filled in yet' : 'Optional, left blank'
  const inPlace = 'hover:bg-muted focus:bg-muted -mx-1 rounded bg-transparent px-1 outline-none'
  // Enter keeps the edit, Escape drops it; either way the field is left, which commits through onBlur
  const keys = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      e.currentTarget.value = value
      e.currentTarget.blur()
    }
  }
  let control: ReactNode
  if (f.kind === 'dropdown')
    control = (
      <select
        value={value}
        aria-label={f.label}
        disabled={busy}
        onChange={(e) => onEdit(f.name, e.target.value)}
        className={cn(inPlace, 'max-w-full min-w-0', !value && 'text-muted-foreground italic')}
      >
        <option value="">{f.required ? 'Not chosen yet' : 'Optional, left blank'}</option>
        {(f.choices ?? []).map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    )
  else if (f.kind === 'checkbox')
    control = (
      <input
        type="checkbox"
        checked={value === 'true'}
        aria-label={f.label}
        disabled={busy}
        onChange={(e) => onEdit(f.name, e.target.checked ? 'true' : '')}
        className="mt-1 size-4 accent-current"
      />
    )
  else if (f.kind === 'date' || f.kind === 'number')
    control = (
      <input
        key={value}
        type={f.kind}
        defaultValue={value}
        aria-label={f.label}
        placeholder={empty}
        disabled={busy}
        onBlur={(e) => onEdit(f.name, e.target.value.trim())}
        onKeyDown={keys}
        className={cn(inPlace, 'placeholder:text-muted-foreground min-w-0 placeholder:italic', !value && 'text-muted-foreground')}
      />
    )
  else
    control = (
      <textarea
        key={value}
        rows={1}
        defaultValue={value}
        placeholder={empty}
        aria-label={f.label}
        disabled={busy}
        onBlur={(e) => onEdit(f.name, e.target.value.trim())}
        onKeyDown={keys}
        className={cn(
          inPlace,
          'placeholder:text-muted-foreground field-sizing-content min-w-0 flex-1 cursor-text resize-none placeholder:italic',
        )}
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
