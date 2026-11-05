import { useAuiState } from '@assistant-ui/react'
import { useEffect } from 'react'

import { GetHelpButton } from '@/components/bdc/form-prefill/get-help-button'
import { NewConversation } from '@/components/bdc/new-conversation'
import { SidebarToggle } from '@/components/bdc/sidebar-toggle'
import { ThemeToggle } from '@/components/bdc/theme-toggle'
import { TOOLS_DEMO } from '@/components/bdc/tool-view'

/** The bar above the thread: sidebar toggle and New conversation on the left, the open
 * conversation's title in the middle (none for a new one; the browser tab shows it too), the
 * theme toggle on the right (with ?tools=demo, the Get help button before it).
 * The thread scrolls below it, so nothing sits over the text. */
export function ChatHeader() {
  const title = useAuiState(
    (s) => s.threads.threadItems.find((t) => t.id === s.threads.mainThreadId)?.title ?? '',
  )
  // the browser tab follows the conversation
  useEffect(() => {
    document.title = title ? `BDC Assist · ${title}` : 'BDC Assist'
  }, [title])
  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
      {/* equal side widths keep the title centred */}
      <div className="flex w-18 items-center gap-1">
        <SidebarToggle />
        <NewConversation />
      </div>
      <h1 className="min-w-0 flex-1 truncate text-center text-sm font-medium">{title}</h1>
      <div className="flex w-18 justify-end gap-1">
        {TOOLS_DEMO && <GetHelpButton />}
        <ThemeToggle />
      </div>
    </header>
  )
}
