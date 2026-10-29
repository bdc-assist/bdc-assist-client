import { useAui, useAuiState } from '@assistant-ui/react'
import { PlusIcon } from 'lucide-react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { useSidebar } from '@/components/ui/sidebar'

/** Starts a new conversation; the current one stays in the saved list. Sits next to the
 * sidebar toggle, shown only while the sidebar (with its own New conversation) is hidden,
 * and while the thread isn't already empty. */
export function NewConversation() {
  const aui = useAui()
  const isEmpty = useAuiState((s) => s.thread.isEmpty)
  const { open, openMobile, isMobile } = useSidebar()
  if (isEmpty || (isMobile ? openMobile : open)) return null
  return (
    <TooltipIconButton
      tooltip="New conversation"
      side="right"
      variant="outline"
      className="absolute top-3 left-14 z-20 size-8 rounded-full p-2"
      onClick={() => aui.threads().switchToNewThread()}
    >
      <PlusIcon />
    </TooltipIconButton>
  )
}
