import { useAui, useAuiState } from '@assistant-ui/react'
import { TrashIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** The sidebar footer's "Delete all conversations", after a confirmation. Opens a new,
 * empty conversation first, then deletes every saved one. Hidden while there are none. */
export function DeleteAllConversations() {
  const aui = useAui()
  const ids = useAuiState((s) => s.threads.threadIds)
  const [confirming, setConfirming] = useState(false)
  if (!ids.length) return null
  const count = ids.length === 1 ? 'the conversation' : `all ${ids.length} conversations`

  const deleteAll = () => {
    const threads = aui.threads()
    threads.switchToNewThread()
    for (const id of ids) threads.item({ id }).delete()
    setConfirming(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start"
        onClick={() => setConfirming(true)}
      >
        <TrashIcon />
        Delete all conversations
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all conversations?</DialogTitle>
            <DialogDescription>
              This deletes {count} saved in this browser. It can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAll}>
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
