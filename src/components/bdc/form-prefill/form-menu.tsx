import { useAui, useAuiState } from '@assistant-ui/react'
import { CheckIcon, MessageCircleQuestionMarkIcon } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toHistory } from '@/lib/bdc-adapter'
import { groupForms, useForms, type FormDef } from '@/lib/forms'
import { cn } from '@/lib/utils'

import { FormDraftTool } from './draft-tool'
import { useFormDraft } from './use-form-draft'

// The header's form menu (design/form-picker.html, option A2): every form bdc-side-panel lists, "Support" ones
// first (HELP_FORMS in lib/forms.ts). Each form has a header draft of its own, separate from any answer's: the
// first pick drafts it in the side panel from the whole conversation (blank in an empty one), with no question;
// later picks open it again. The menu marks the open draft (✓) and the others drafted (dot); the panel's own Close
// closes it. Another conversation starts over (the drafts are dropped, as an answer's are). None while
// bdc-side-panel lists no forms.

type DraftState = { stage: 'none' | 'drafting' | 'draft'; isOpen: boolean }
type Control = { pick: () => void }

export function FormMenu() {
  const aui = useAui()
  const [conversation, setConversation] = useState(0)
  useEffect(() => aui.on('threads.selectionChanged', () => setConversation((n) => n + 1)), [aui])
  const forms = useForms()
  return forms.length > 0 && <Menu key={conversation} forms={forms} />
}

function Menu({ forms }: { forms: FormDef[] }) {
  // each form's draft lives in its HeaderDraft, mounted while the menu is closed too (so a draft outlives it): the
  // drafts report their state here, and the menu works them through their controls
  const [states, setStates] = useState<Record<string, DraftState>>({})
  const controls = useRef(new Map<string, Control>())
  // stable, so a draft reports only when its own state changes
  const report = useCallback((id: string, s: DraftState) => setStates((all) => ({ ...all, [id]: s })), [])
  const open = forms.find((f) => states[f.id]?.isOpen)
  const drafted = forms.some((f) => (states[f.id]?.stage ?? 'none') !== 'none')
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TooltipIconButton
            tooltip="Get help or fill in a BDC form"
            side="bottom"
            variant="ghost"
            className={cn('relative size-8 p-2', open && 'bg-accent text-accent-foreground')}
          >
            <MessageCircleQuestionMarkIcon />
            {drafted && <span aria-hidden className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" />}
          </TooltipIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-56">
          {groupForms(forms).map((g, i) => (
            <Fragment key={g.label}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
              {g.forms.map((f) => (
                <DropdownMenuItem key={f.id} onSelect={() => controls.current.get(f.id)?.pick()}>
                  <Mark state={states[f.id]} />
                  {f.title}
                </DropdownMenuItem>
              ))}
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {forms.map((f) => (
        <HeaderDraft key={f.id} form={f} controls={controls} onState={report} />
      ))}
    </>
  )
}

// ✓ for the open draft, a dot for one that exists, else blank: the names stay lined up
function Mark({ state }: { state: DraftState | undefined }) {
  return (
    <span aria-hidden className="flex size-4 items-center justify-center">
      {state?.isOpen ? (
        <CheckIcon />
      ) : (
        (state?.stage ?? 'none') !== 'none' && <span className="bg-primary size-1.5 rounded-full" />
      )}
    </span>
  )
}

// one form's header draft: no UI but its tool, while open
function HeaderDraft({
  form,
  controls,
  onState,
}: {
  form: FormDef
  controls: RefObject<Map<string, Control>>
  onState: (id: string, s: DraftState) => void
}) {
  const d = useFormDraft(form)
  const messages = useAuiState((s) => s.thread.messages)
  const isOpen = d.tool.isOpen
  // every render, so the menu always calls this render's (latest messages); not state, so no re-render
  useEffect(() => {
    controls.current.set(form.id, {
      pick: () => {
        if (isOpen) return
        if (d.stage === 'none') void d.prefill({ history: toHistory(messages), question: null })
        else d.tool.open()
      },
    })
  })
  useEffect(() => {
    const all = controls.current
    return () => void all.delete(form.id)
  }, [controls, form.id])
  useEffect(() => onState(form.id, { stage: d.stage, isOpen }), [onState, form.id, d.stage, isOpen])
  return isOpen && <FormDraftTool form={form} d={d} />
}
