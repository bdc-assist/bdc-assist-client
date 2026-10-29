import { PanelLeftIcon } from 'lucide-react'
import { useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { useSidebar } from '@/components/ui/sidebar'

const KEY = 'bdc-sidebar' // 'open' | 'closed': the user's last pick on wide screens; none: open

/** Whether the conversations sidebar is open on wide screens, remembered across visits
 * (shadcn's cookie only matters with a server to read it). On narrow screens it's a
 * sheet that starts closed. */
export function useSidebarOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== 'closed'
    } catch {
      return true // storage blocked (private window)
    }
  })
  return [
    open,
    (next) => {
      setOpen(next)
      try {
        localStorage.setItem(KEY, next ? 'open' : 'closed')
      } catch {
        // not remembered: fine
      }
    },
  ]
}

/** Opens and closes the conversations sidebar (Ctrl/⌘+B does too). */
export function SidebarToggle() {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar()
  const shown = isMobile ? openMobile : open
  return (
    <TooltipIconButton
      tooltip={shown ? 'Hide conversations' : 'Show conversations'}
      side="right"
      variant="outline"
      className="absolute top-3 left-4 z-20 size-8 rounded-full p-2"
      onClick={toggleSidebar}
    >
      <PanelLeftIcon />
    </TooltipIconButton>
  )
}
