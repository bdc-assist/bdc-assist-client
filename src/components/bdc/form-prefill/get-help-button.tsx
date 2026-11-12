import { useAui, useAuiState } from '@assistant-ui/react'
import { MessageCircleQuestionMarkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { GET_HELP } from '@/lib/forms'
import { cn } from '@/lib/utils'

import { FormDraftTool } from './draft-tool'
import { useFormDraft } from './use-form-draft'

/** The header's Get help button: a stand-in for a form card, with its own Get Help draft,
 * separate from any answer's. The first click drafts it in the side panel from the conversation (blank in an
 * empty one); later clicks open and close it. Pressed while its draft is open; a dot once it has one. Another
 * conversation starts over (the draft is dropped, as an answer's is). */
export function GetHelpButton() {
  const aui = useAui()
  const [conversation, setConversation] = useState(0)
  useEffect(() => aui.on('threads.selectionChanged', () => setConversation((n) => n + 1)), [aui])
  return <HeaderDraft key={conversation} />
}

function HeaderDraft() {
  const d = useFormDraft()
  const isEmpty = useAuiState((s) => s.thread.isEmpty)
  const open = d.tool.isOpen
  return (
    <>
      <TooltipIconButton
        tooltip={open ? `Close the ${GET_HELP.title}` : 'Get help from the BDC help desk'}
        side="bottom"
        variant="ghost"
        aria-pressed={open}
        className={cn('relative size-8 p-2', open && 'bg-accent text-accent-foreground')}
        onClick={() => (open ? d.tool.close() : d.stage === 'none' ? void d.prefill(isEmpty) : d.tool.open())}
      >
        <MessageCircleQuestionMarkIcon />
        {d.stage !== 'none' && <span aria-hidden className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" />}
      </TooltipIconButton>
      {open && <FormDraftTool form={GET_HELP} d={d} />}
    </>
  )
}
