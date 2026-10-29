import { useAui } from '@assistant-ui/react'
import { useEffect } from 'react'

import { useSidebar } from '@/components/ui/sidebar'

/** When another conversation opens (picked in the list, New conversation, Delete all):
 * on phones, closes the sidebar sheet so the conversation shows; elsewhere, puts the cursor
 * in the composer. assistant-ui's own refocus skips this when focus is on the list item
 * that was clicked. No focus on phones: it would pop the keyboard up over the answer. */
export function ConversationSwitch() {
  const aui = useAui()
  const { isMobile, setOpenMobile } = useSidebar()
  useEffect(
    () =>
      aui.on('threads.selectionChanged', () => {
        if (isMobile) {
          setOpenMobile(false)
          return
        }
        // after the new thread's composer has rendered
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.aui-composer-input')?.focus())
      }),
    [aui, isMobile, setOpenMobile],
  )
  return null
}
