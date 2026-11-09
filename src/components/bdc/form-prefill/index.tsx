import { LoaderIcon } from 'lucide-react'

import { ToolCard } from '@/components/bdc/tool-view'
import type { FormDef } from '@/lib/forms'

import { FormDraftTool } from './draft-tool'
import { useFormDraft } from './use-form-draft'

// Form prefill (bdc-assist#64, design/form-prefill.html), ?tools=demo only: an answer citing a form's page
// offers to fill it in: the form's card, whose open button drafts it in the tool view. Nothing is added to the
// conversation, and the card then shows the draft (always as it is now). The draft is refined in the
// tool: by its chat, or by clicking a value and typing. Open on BDC goes to the BDC page with the values as URL
// parameters, where the user still checks and submits. The header's Get help button (get-help-button.tsx) has a
// draft of its own, the same way. use-form-draft.ts: a draft's state; draft-tool.tsx: the draft in the tool view.

export function FormPrefill({ form }: { form: FormDef }) {
  const d = useFormDraft()

  // the offer is the same card, before there's a draft: opening it drafts the form in the tool view
  if (d.stage === 'none')
    return (
      <ToolCard
        kind="form"
        name={form.title}
        summary="bdc-assist can fill this in from the conversation. Open it in the side panel to start."
        isOpen={false}
        onOpen={() => void d.prefill()}
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
