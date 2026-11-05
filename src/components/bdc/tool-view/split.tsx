import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import { CardPointer } from './card-pointer'
import { Context, type ToolViewContext } from './context'
import { MIN_CONVERSATION, MIN_TOOL, TOOLS, type ToolKind } from './tools'

type Widths = Record<ToolKind, number>

// the width the user dragged each tool to, remembered in this browser; none: the tool's starting width
const WIDTHS_KEY = 'bdc-tool-widths'
const DEFAULT_WIDTHS = Object.fromEntries(Object.entries(TOOLS).map(([k, l]) => [k, l.pct])) as Widths

function readWidths(): Widths {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? '{}') as Partial<Widths>
    const valid = Object.entries(saved).filter(([k, v]) => k in TOOLS && typeof v === 'number' && v > 0 && v < 100)
    return { ...DEFAULT_WIDTHS, ...Object.fromEntries(valid) }
  } catch {
    return DEFAULT_WIDTHS // storage blocked (private window), or not JSON
  }
}

function saveWidths(widths: Widths) {
  try {
    localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths))
  } catch {
    // not remembered: fine
  }
}

/** Which tool is open, for everything inside: the split (ToolSplit) and whatever opens tools, in the
 * conversation or outside it (the header's Get help button). */
export function ToolViewProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ToolViewContext['open']>(null)
  const [conversationHidden, setConversationHidden] = useState(false)
  const [cardOff, setCardOff] = useState<'up' | 'down' | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const openTool = useCallback((owner: string, kind: ToolKind) => {
    setOpen({ owner, kind })
    setConversationHidden(TOOLS[kind].hideConversation)
  }, [])
  const close = useCallback(() => setOpen(null), [])
  const toggleConversation = useCallback(() => setConversationHidden((h) => !h), [])
  const value = useMemo(
    () => ({ open, openTool, close, target, conversationHidden, toggleConversation, cardOff, setTarget, setCardOff }),
    [open, openTool, close, target, conversationHidden, toggleConversation, cardOff],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** The thread with the tool view beside it. Inside a ToolViewProvider. */
export function ToolSplit({ children }: { children: ReactNode }) {
  const ctx = useContext(Context)
  const [widths, setWidths] = useState(readWidths) // each tool's wanted width, % of the row
  const [rowWidth, setRowWidth] = useState(0) // px, kept up to date: the clamp follows the window
  const row = useRef<HTMLDivElement>(null)
  const narrow = useIsMobile()
  const open = ctx?.open ?? null
  const conversationHidden = ctx?.conversationHidden ?? false

  useEffect(() => {
    const r = row.current
    if (!r) return
    const observer = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width))
    observer.observe(r)
    return () => observer.disconnect()
  }, [])
  // the conversation keeps MIN_CONVERSATION and the tool MIN_TOOL, the conversation first when both can't.
  // Applied when shown, so the wanted width comes back when the window widens again
  const clamp = (p: number) =>
    rowWidth ? Math.min(100 - (MIN_CONVERSATION / rowWidth) * 100, Math.max((MIN_TOOL / rowWidth) * 100, p)) : p
  const pct = open ? clamp(widths[open.kind]) : 0

  // the divider: drag, arrow keys (5% a press), double-click for the tool's starting width. Remembered per tool
  const setSplit = (next: number) => {
    if (!open) return
    const kind = open.kind
    setWidths((w) => {
      const updated = { ...w, [kind]: clamp(next) }
      saveWidths(updated)
      return updated
    })
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const d = e.currentTarget
    d.setPointerCapture(e.pointerId)
    d.dataset.dragging = ''
    const move = (ev: globalThis.PointerEvent) => {
      const r = row.current?.getBoundingClientRect()
      if (r) setSplit(((r.right - ev.clientX) / r.width) * 100)
    }
    d.addEventListener('pointermove', move)
    d.addEventListener(
      'pointerup',
      () => {
        delete d.dataset.dragging
        d.removeEventListener('pointermove', move)
      },
      { once: true },
    )
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setSplit(pct + 5)
    if (e.key === 'ArrowRight') setSplit(pct - 5)
  }

  const split = open && !narrow && !conversationHidden // conversation, divider and tool side by side
  return (
    <div ref={row} className="relative flex h-full min-h-0">
      {/* hidden, not removed: the answer that owns the tool stays mounted */}
      <div className={cn('h-full min-w-0 flex-1', open && !narrow && conversationHidden && 'hidden')}>
        {children}
      </div>
      {split && ctx && <CardPointer row={row} onOff={ctx.setCardOff} />}
      {split && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the tool view"
          aria-valuenow={Math.round(100 - pct)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          onDoubleClick={() => open && setSplit(TOOLS[open.kind].pct)}
          className="group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize touch-none outline-none"
        >
          <div className="bg-border group-hover:bg-muted-foreground group-focus-visible:bg-muted-foreground group-data-dragging:bg-muted-foreground absolute inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:w-[3px] group-focus-visible:w-[3px] group-data-dragging:w-[3px]" />
        </div>
      )}
      {open && (
        <aside
          ref={ctx?.setTarget}
          aria-label="Tool view"
          style={split ? { width: `${pct}%` } : undefined}
          className={cn(
            'bg-background flex min-w-0 flex-col',
            narrow ? 'fixed inset-0 z-50' : split ? 'shrink-0' : 'flex-1',
          )}
        />
      )}
    </div>
  )
}
