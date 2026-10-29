import { useAui, useAuiState } from '@assistant-ui/react'
import { ListRestartIcon } from 'lucide-react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'

/** Starts a new conversation; the current one stays in the saved list.
 * Hidden while the thread is already empty. */
export function NewConversation() {
  const aui = useAui()
  const isEmpty = useAuiState((s) => s.thread.isEmpty)
  if (isEmpty) return null
  return (
    <TooltipIconButton
      tooltip="New conversation"
      side="left"
      variant="outline"
      className="absolute top-3 right-16 z-20 size-8 rounded-full p-2"
      onClick={() => aui.threads().switchToNewThread()}
    >
      <ListRestartIcon />
    </TooltipIconButton>
  )
}
