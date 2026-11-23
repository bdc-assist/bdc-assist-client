import { useAuiState } from '@assistant-ui/react'
import { LoaderIcon } from 'lucide-react'

import { ToolCard } from '@/components/bdc/tool-view'
import { toHistory } from '@/lib/bdc-adapter'
import type { FormDef } from '@/lib/forms'

import { FormDraftTool } from './draft-tool'
import { useFormDraft } from './use-form-draft'

// Form prefill (bdc-assist#64, design/form-prefill.html): an answer the server offers a form under (bdc-assist's
// BDC config: form_offer) gets the form's card, whose open button drafts it in the tool view, by bdc-side-panel,
// from the conversation up to that answer and its question. Nothing is added to the conversation, and the card then
// shows the draft (always as it is now). The draft is refined in the tool: by its chat, or by clicking a value and
// typing. Open form goes to the BDC page with the values as URL parameters, where the user still checks and
// submits. The header's Get help button (get-help-button.tsx) has a draft of its own, the same way.
// use-form-draft.ts: a draft's state; draft-tool.tsx: the draft in the tool view.

export function FormPrefill({ form, question }: { form: FormDef; question: string | null }) {
  const d = useFormDraft(form)
  const messages = useAuiState((s) => s.thread.messages)
  const index = useAuiState((s) => s.message.index)

  // the offer is the same card, before there's a draft: opening it drafts the form in the tool view
  if (d.stage === 'none')
    return (
      <ToolCard
        kind="form"
        name={form.title}
        summary="bdc-assist can fill this in from the conversation. Open it in the side panel to start."
        isOpen={false}
        onOpen={() => void d.prefill({ history: toHistory(messages.slice(0, index + 1)), question })}
      />
    )

  // the draft's card (the card every tool's object has): the draft as it is now
  return (
    <>
      <ToolCard
        kind="form"
        name={form.title}
        summary={d.summary}
        edited={d.edited}
        status={
          d.stage === 'drafting' && (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <LoaderIcon className="size-3.5 animate-spin" />
              Drafting…
            </span>
          )
        }
        isOpen={d.tool.isOpen}
        onOpen={d.tool.open}
      />
      {d.tool.isOpen && <FormDraftTool form={form} d={d} />}
    </>
  )
}
