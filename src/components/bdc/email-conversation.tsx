import { useAuiState } from '@assistant-ui/react'
import { lazy, Suspense, useSyncExternalStore } from 'react'

import { Dialog } from '@/components/ui/dialog'

// "Email…" in an answer's menu, next to Export as Markdown (design/email-export.html): a dialog picks this answer or the whole
// conversation, with or without its graphs; the email is copied (HTML + plain text, see
// lib/email-export.tsx) and, unless "Copy only", the mail client opens with the subject for
// the user to paste into. A mailto: body can't carry HTML or images, and long ones get cut.

// The answer whose Email was picked. The dialog lives outside the message (mounted once,
// EmailDialog): an older answer's action bar goes away when the pointer leaves the answer,
// e.g. into the dialog, and would take a dialog inside it along.
let target: string | null = null
const listeners = new Set<() => void>()
const setTarget = (id: string | null) => {
  target = id
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Opens the Email dialog for this answer: for its "Email…" item in the action bar's menu.
 * After the menu has closed, so the focus it hands back to its trigger doesn't land after
 * the dialog has taken it. */
export function useOpenEmail() {
  const id = useAuiState((s) => s.message.id)
  return () => void setTimeout(() => setTarget(id))
}

const EmailChoices = lazy(() => import('@/components/bdc/email-choices'))

/** Mount once inside the runtime provider. */
export function EmailDialog() {
  const answerId = useSyncExternalStore(subscribe, () => target)
  const close = () => setTarget(null)
  return (
    <Dialog open={answerId !== null} onOpenChange={(open) => !open && close()}>
      {answerId !== null && (
        <Suspense fallback={null}>
          <EmailChoices answerId={answerId} onClose={close} />
        </Suspense>
      )}
    </Dialog>
  )
}
