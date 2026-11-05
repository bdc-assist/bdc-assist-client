import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CornerDownRightIcon,
  FileTextIcon,
  LoaderIcon,
  Share2Icon,
  XIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// The tool view (design/form-prefill.html, design/tool-view.html): an object from an answer (a graph, a form draft)
// opens beside the conversation in a split, with a draggable divider, or full screen on a narrow window. Every tool
// looks the same: the same card in the answer, the same header here (TOOLS gives each its icon and name). Demo only for now:
// ?tools=demo turns it on; without it the graph keeps its maximize dialog.
// The answer that owns the object renders it into the tool view through a portal (useToolView), so its state
// stays where it is, and the tool view sits outside the message (whose content-visibility clips painting).

export const TOOLS_DEMO = new URLSearchParams(location.search).get('tools') === 'demo'

// each tool's icon and name (its card and its header), and its starting layout: its share of the width, and
// whether the conversation starts hidden. A graph gets more room than a form
export const TOOLS: Record<'graph' | 'form', { icon: LucideIcon; name: string; pct: number; hideConversation: boolean }> = {
  graph: { icon: Share2Icon, name: 'Knowledge graph', pct: 60, hideConversation: false },
  form: { icon: FileTextIcon, name: 'Form', pct: 40, hideConversation: false },
}
const TOOL_LAYOUT = TOOLS
export type ToolKind = keyof typeof TOOLS
type Widths = Record<ToolKind, number>

// the width the user dragged each tool to, remembered in this browser; none: the tool's starting width
const WIDTHS_KEY = 'bdc-tool-widths'
const DEFAULT_WIDTHS = Object.fromEntries(Object.entries(TOOL_LAYOUT).map(([k, l]) => [k, l.pct])) as Widths

function readWidths(): Widths {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? '{}') as Partial<Widths>
    const valid = Object.entries(saved).filter(([k, v]) => k in TOOL_LAYOUT && typeof v === 'number' && v > 0 && v < 100)
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

// the conversation keeps at least this, and the tool view too (px)
const MIN_CONVERSATION = 360
const MIN_TOOL = 320

type ToolViewContext = {
  open: { owner: string; kind: ToolKind } | null
  openTool: (owner: string, kind: ToolKind) => void
  close: () => void
  target: HTMLElement | null // where the open tool renders
  conversationHidden: boolean
  toggleConversation: () => void
  cardOff: 'up' | 'down' | null // where the open tool's card is while it's out of sight in the conversation
}

const Context = createContext<ToolViewContext | null>(null)

/** The thread with the tool view beside it. */
export function ToolSplit({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ToolViewContext['open']>(null)
  const [widths, setWidths] = useState(readWidths) // each tool's wanted width, % of the row
  const [rowWidth, setRowWidth] = useState(0) // px, kept up to date: the clamp follows the window
  const [conversationHidden, setConversationHidden] = useState(false)
  const [cardOff, setCardOff] = useState<'up' | 'down' | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const row = useRef<HTMLDivElement>(null)
  const narrow = useIsMobile()

  const openTool = useCallback((owner: string, kind: ToolKind) => {
    setOpen({ owner, kind })
    setConversationHidden(TOOL_LAYOUT[kind].hideConversation)
  }, [])
  const close = useCallback(() => setOpen(null), [])
  const toggleConversation = useCallback(() => setConversationHidden((h) => !h), [])
  const value = useMemo(
    () => ({ open, openTool, close, target, conversationHidden, toggleConversation, cardOff }),
    [open, openTool, close, target, conversationHidden, toggleConversation, cardOff],
  )

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
    <Context.Provider value={value}>
      <div ref={row} className="relative flex h-full min-h-0">
        {/* hidden, not removed: the answer that owns the tool stays mounted */}
        <div className={cn('h-full min-w-0 flex-1', open && !narrow && conversationHidden && 'hidden')}>
          {children}
        </div>
        {split && <Connector row={row} onOff={setCardOff} />}
        {split && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the tool view"
            aria-valuenow={Math.round(100 - pct)}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onDoubleClick={() => open && setSplit(TOOL_LAYOUT[open.kind].pct)}
            className="group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize touch-none outline-none"
          >
            <div className="bg-border group-hover:bg-muted-foreground group-focus-visible:bg-muted-foreground group-data-dragging:bg-muted-foreground absolute inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:w-[3px] group-focus-visible:w-[3px] group-data-dragging:w-[3px]" />
          </div>
        )}
        {open && (
          <aside
            ref={setTarget}
            aria-label="Tool view"
            style={split ? { width: `${pct}%` } : undefined}
            className={cn(
              'bg-background flex min-w-0 flex-col',
              narrow ? 'fixed inset-0 z-50' : split ? 'shrink-0' : 'flex-1',
            )}
          />
        )}
      </div>
    </Context.Provider>
  )
}

/** Put on the open tool's card in the answer (its header row): the connector starts there. */
export const TOOL_ANCHOR = { 'data-tool-anchor': '' }

// A curve from the open tool's card in the conversation to the tool's header, so it's clear which answer the tool
// belongs to. While the card is out of sight (scrolled away, or under the composer) there's no curve: instead the
// tool's header shows a small button pointing up or down to it (`onOff`), which scrolls it into view (showCard).
// Measured every frame while shown: the card moves with scrolling, streaming answers, the divider and the window,
// and a frame loop is simpler than observing all of those. Written to the DOM directly; only where the card is
// (in sight, above, below) is React state, set when it changes.
function Connector({ row, onOff }: { row: RefObject<HTMLDivElement | null>; onOff: (off: 'up' | 'down' | null) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    let frame = 0
    let off: 'up' | 'down' | null = null
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const r = row.current
      const el = svg.current
      if (!r || !el) return
      const anchor = r.querySelector('[data-tool-anchor]')
      const head = r.querySelector('[data-tool-head]')
      const viewport = r.querySelector('[data-slot="aui_thread-viewport"]')
      const footer = r.querySelector('.aui-thread-viewport-footer')
      const box = r.getBoundingClientRect()
      const a = anchor?.getBoundingClientRect()
      const b = head?.getBoundingClientRect()
      const top = viewport?.getBoundingClientRect().top ?? box.top
      const bottom = footer?.getBoundingClientRect().top ?? box.bottom
      const mid = a ? a.top + a.height / 2 : 0
      const now = !a || !b ? null : mid < top ? 'up' : mid > bottom ? 'down' : null
      if (now !== off) onOff((off = now))
      if (!a || !b || now) {
        el.style.visibility = 'hidden'
        return
      }
      const x1 = a.right - box.left
      const x2 = b.left - box.left
      const ya = mid - box.top
      const yb = b.top + b.height / 2 - box.top
      const c = Math.max(24, (x2 - x1) / 2)
      const [path, start, end] = el.children as unknown as SVGElement[]
      path.setAttribute('d', `M${x1} ${ya}C${x1 + c} ${ya} ${x2 - c} ${yb} ${x2} ${yb}`)
      start.setAttribute('cx', `${x1}`)
      start.setAttribute('cy', `${ya}`)
      end.setAttribute('cx', `${x2}`)
      end.setAttribute('cy', `${yb}`)
      el.style.visibility = 'visible'
    }
    tick()
    return () => {
      cancelAnimationFrame(frame)
      onOff(null)
    }
  }, [row, onOff])
  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 size-full"
      style={{ visibility: 'hidden' }}
    >
      <path className="stroke-ring fill-none" strokeWidth={1.5} />
      <circle r={3} className="fill-ring" />
      <circle r={3} className="fill-ring" />
    </svg>
  )
}

/** Scrolls the open tool's card into the middle of the conversation and briefly tints it. */
function showCard() {
  const anchor = document.querySelector('[data-tool-anchor]')
  if (!anchor) return
  anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
  // once it's had time to arrive
  setTimeout(
    () =>
      anchor.animate([{ backgroundColor: 'var(--color-muted)' }, { backgroundColor: 'transparent' }], {
        duration: 1200,
        easing: 'ease-out',
      }),
    400,
  )
}

/** For the answer that owns an object: whether its tool is open, and open/close. Closes the tool if the answer
 * goes away (another conversation) while it's open. */
export function useToolView(kind: ToolKind) {
  const ctx = useContext(Context)
  const owner = useId()
  const isOpen = ctx?.open?.owner === owner
  const { openTool, close } = ctx ?? {}
  const open = useCallback(() => openTool?.(owner, kind), [openTool, owner, kind])
  const openRef = useRef(isOpen)
  useEffect(() => {
    openRef.current = isOpen
  })
  useEffect(() => () => void (openRef.current && close?.()), [close])
  return { available: Boolean(ctx), isOpen, open, close: close ?? (() => {}) }
}

/** The open tool's frame, rendered into the tool view. Its header, the same for every tool: show the card in the
 * conversation (while it's out of sight), expand to full width / show conversation, the tool's icon and `name`
 * (default: the tool's), Edited (a menu with Reset to original) and the `summary`, then Undo/Redo and the tool's
 * own action (`actions`), Close. Render it only while the tool is open. */
export function ToolViewFrame(props: {
  kind: ToolKind
  name?: string
  summary?: string
  edited?: boolean
  onReset?: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  const ctx = useContext(Context)
  const narrow = useIsMobile()
  const [menu, setMenu] = useState(false)
  if (!ctx?.target) return null
  const { icon: Icon, name } = TOOLS[props.kind]
  // chevrons change the tool view's width; the panel icons stay the conversations sidebar's (and the card's)
  const tip = ctx.conversationHidden ? 'Show conversation' : 'Expand to full width'
  return createPortal(
    <>
      <div data-tool-head className="@container relative flex h-10 shrink-0 items-center gap-2 border-b px-2 text-xs">
        {ctx.cardOff && (
          <TooltipIconButton
            tooltip="Show in conversation"
            side="bottom"
            variant="outline"
            // on the header's left edge, half in the gutter beside it
            className="dark:border-border dark:bg-background dark:hover:bg-accent absolute top-1/2 left-0 z-30 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full p-1"
            onClick={showCard}
          >
            {ctx.cardOff === 'down' ? <ArrowDownIcon /> : <ArrowUpIcon />}
          </TooltipIconButton>
        )}
        {!narrow && (
          <TooltipIconButton tooltip={tip} side="bottom" className="size-7 p-1.5" onClick={ctx.toggleConversation}>
            {ctx.conversationHidden ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
          </TooltipIconButton>
        )}
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-sm font-medium">{props.name ?? name}</span>
          {props.edited && (
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="bg-muted text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-0.5 rounded-full px-2 text-[11px] leading-[18px]"
                >
                  Edited
                  <ChevronDownIcon className="size-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-56 gap-0 p-1">
                <p className="text-muted-foreground px-2 py-1 text-xs">Changed since this answer</p>
                <button
                  type="button"
                  className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-start text-sm"
                  onClick={() => {
                    setMenu(false)
                    props.onReset?.()
                  }}
                >
                  Reset to original
                </button>
              </PopoverContent>
            </Popover>
          )}
          {props.summary && <span className="text-muted-foreground min-w-0 truncate">{props.summary}</span>}
        </span>
        {props.actions}
        <TooltipIconButton tooltip="Close" side="bottom" className="size-7 p-1.5" onClick={ctx.close}>
          <XIcon />
        </TooltipIconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{props.children}</div>
    </>,
    ctx.target,
  )
}

export type ToolMessage = { role: 'user' | 'tool'; text: string }

/** The tool's own chat, under the object: its messages change the object in place and don't appear in the
 * conversation. `suggestion`: a message to offer as a button; `busy`: a change is being made. */
export function ToolChat(props: {
  what: string // "graph", "draft": for the hint and the placeholder
  messages: ToolMessage[]
  suggestion?: string | null
  busy?: boolean
  onSend: (text: string) => void
}) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  // braces: scrollIntoView may return a promise (newer browsers), which React would take for a cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [props.messages.length, props.busy])
  const send = (t: string) => {
    if (!t.trim() || props.busy) return
    props.onSend(t.trim())
    setText('')
  }
  return (
    <div className="shrink-0 border-t text-sm">
      <div className="flex max-h-40 flex-col gap-2 overflow-y-auto px-3 pt-2">
        <p className="text-muted-foreground text-xs">
          Messages here change this {props.what} in place. They don&apos;t appear in the conversation.
        </p>
        {props.messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="bg-muted self-end rounded-2xl px-3 py-1.5">
              {m.text}
            </div>
          ) : (
            <p key={i}>{m.text}</p>
          ),
        )}
        {props.busy && (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <LoaderIcon className="size-3.5 animate-spin" />
            Working…
          </p>
        )}
        {props.suggestion && !props.busy && (
          <button
            type="button"
            onClick={() => send(props.suggestion!)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground -mx-1.5 flex items-center gap-1.5 self-start rounded-md px-1.5 py-0.5 text-start"
          >
            <CornerDownRightIcon className="size-3.5" />
            {props.suggestion}
          </button>
        )}
        <div ref={end} />
      </div>
      <form
        // the thread's composer box (thread.aui.tsx); its --composer-bg is set on the thread, so repeated here
        className="border-foreground/10 focus-within:border-foreground/25 m-3 flex items-end gap-2 rounded-2xl border bg-[color-mix(in_oklab,var(--color-muted)_30%,transparent)] px-3 py-2 transition-[border-color]"
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(text)
            }
          }}
          placeholder={`Ask for changes to this ${props.what}…`}
          className="caret-primary placeholder:text-muted-foreground/60 max-h-32 min-h-6 flex-1 resize-none bg-transparent outline-none"
        />
        <TooltipIconButton
          tooltip="Send"
          side="top"
          type="submit"
          variant="default"
          className="size-7 rounded-full p-1.5"
          disabled={!text.trim() || props.busy}
        >
          <ArrowUpIcon />
        </TooltipIconButton>
      </form>
    </div>
  )
}
