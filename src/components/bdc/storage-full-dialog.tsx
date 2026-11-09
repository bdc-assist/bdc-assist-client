import { useAui, useAuiState } from '@assistant-ui/react'
import { CheckIcon, HardDriveIcon, NetworkIcon, TrashIcon } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GRAPH_PART } from '@/lib/bdc-adapter'
import { messagesKey, STORAGE_QUOTA, type ConversationStorage } from '@/lib/conversation-storage'

// Shown when saving fails because the browser's storage is full: lists the other saved
// conversations, oldest first, with their size, to delete some. The failed save is retried
// after each deletion; once it lands, the dialog says so. "Not now" stops it coming back
// until the next visit (the open conversation then isn't kept after a reload).

/** Characters as KB/MB (near enough bytes for the plain text stored). */
function size(chars: number): string {
  return chars >= 1024 * 1000
    ? `${(chars / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(chars / 1024))} KB`
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function ago(date: Date | null): string {
  if (!date) return ''
  const minutes = Math.round((date.getTime() - Date.now()) / 60000)
  if (minutes > -60) return relative.format(minutes, 'minute')
  if (minutes > -1440) return relative.format(Math.round(minutes / 60), 'hour')
  return relative.format(Math.round(minutes / 1440), 'day')
}

type Row = { id: string; title: string; chars: number; lastAt: Date | null; graph: boolean }

/** A stored conversation's size, latest message time and whether it holds a graph. */
function inspect(raw: string | null): Omit<Row, 'id' | 'title'> {
  if (!raw) return { chars: 0, lastAt: null, graph: false }
  let lastAt: Date | null = null
  try {
    const { messages } = JSON.parse(raw) as { messages: { message: { createdAt: string } }[] }
    const times = messages.map((m) => Date.parse(m.message.createdAt)).filter((t) => !Number.isNaN(t))
    if (times.length) lastAt = new Date(Math.max(...times))
  } catch {
    // unreadable: no date
  }
  return { chars: raw.length, lastAt, graph: raw.includes(`"${GRAPH_PART}"`) }
}

export function StorageFullDialog({ storage }: { storage: ConversationStorage }) {
  const aui = useAui()
  const status = useSyncExternalStore(storage.subscribe, storage.status)
  const items = useAuiState((s) => s.threads.threadItems)
  const openId = useAuiState((s) => s.threads.mainThreadId)
  const [phase, setPhase] = useState<'closed' | 'full' | 'saved'>('closed')
  const [dismissed, setDismissed] = useState(false)
  // open on a failed save, unless put off; say "saved" if it lands while open
  const [wasFull, setWasFull] = useState(status.full)
  if (status.full !== wasFull) {
    setWasFull(status.full)
    if (status.full && !dismissed && phase === 'closed') setPhase('full')
    if (!status.full && phase === 'full') setPhase('saved')
  }

  // read from storage on each render while the list is shown (it re-renders on each deletion)
  const rows: Row[] =
    phase !== 'full'
      ? []
      : items
          .filter((t) => t.id !== openId && t.remoteId)
          .map((t) => ({
            id: t.id,
            title: t.title || 'New conversation',
            ...inspect(storage.peek(messagesKey(t.remoteId!))),
          }))
          .sort((a, b) => (a.lastAt?.getTime() ?? 0) - (b.lastAt?.getTime() ?? 0))
  const used = phase === 'full' ? storage.usage() : 0

  const close = () => {
    if (phase === 'full') setDismissed(true)
    setPhase('closed')
  }

  return (
    <Dialog open={phase !== 'closed'} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        {phase === 'saved' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckIcon className="size-4 text-green-600 dark:text-green-500" />
                Saved
              </DialogTitle>
              <DialogDescription>
                There's room again, and this conversation is saved in your browser.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HardDriveIcon className="size-4" />
                Browser storage is full
              </DialogTitle>
              <DialogDescription>
                The latest answer couldn't be saved. Delete conversations to make room{' '}
                <span className="text-foreground font-medium">(about {size(status.needed)} more)</span>{' '}
                and it's saved straight away.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full transition-[width]"
                  style={{ width: `${Math.min(100, (used / STORAGE_QUOTA) * 100)}%` }}
                />
              </div>
              <span className="text-muted-foreground text-xs">
                {size(used)} of about {size(STORAGE_QUOTA)} used
              </span>
            </div>
            {rows.length ? (
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{r.title}</div>
                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        {[ago(r.lastAt), size(r.chars)].filter(Boolean).join(' · ')}
                        {r.graph && (
                          <span
                            title="Includes a knowledge graph"
                            className="ml-1 inline-flex items-center gap-0.5 rounded border px-1"
                          >
                            <NetworkIcon className="size-3" />
                            graph
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => aui.threads().item({ id: r.id }).delete()}
                    >
                      <TrashIcon />
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                There are no other conversations to delete. Storage is shared with the rest of
                this site, so clearing its data in the browser's settings may help.
              </p>
            )}
            <DialogFooter className="items-center">
              <span className="text-muted-foreground mr-auto text-xs">
                Without it, this conversation won't be kept after a reload.
              </span>
              <Button variant="outline" onClick={close}>
                Not now
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
