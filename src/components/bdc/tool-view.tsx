import { ArrowUpIcon, CornerDownRightIcon, LoaderIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, XIcon } from 'lucide-react'
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
} from 'react'
import { createPortal } from 'react-dom'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// The tool view (design/form-prefill.html): an object from an answer (a graph, later a form draft) opens beside
// the conversation in a split, with a draggable divider, or full screen on a narrow window. Demo only for now:
// ?tools=demo turns it on; without it the graph keeps its maximize dialog.
// The answer that owns the object renders it into the tool view through a portal (useToolView), so its state
// stays where it is, and the tool view sits outside the message (whose content-visibility clips painting).

export const TOOLS_DEMO = new URLSearchParams(location.search).get('tools') === 'demo'

// each tool's starting layout: its share of the width, and whether the conversation starts hidden
const TOOL_LAYOUT = {
  graph: { pct: 70, hideConversation: true },
  form: { pct: 40, hideConversation: false },
}
export type ToolKind = keyof typeof TOOL_LAYOUT

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
}

const Context = createContext<ToolViewContext | null>(null)

/** The thread with the tool view beside it. */
export function ToolSplit({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ToolViewContext['open']>(null)
  const [pct, setPct] = useState(TOOL_LAYOUT.graph.pct)
  const [conversationHidden, setConversationHidden] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const row = useRef<HTMLDivElement>(null)
  const narrow = useIsMobile()

  const openTool = useCallback((owner: string, kind: ToolKind) => {
    setOpen({ owner, kind })
    setPct(TOOL_LAYOUT[kind].pct)
    setConversationHidden(TOOL_LAYOUT[kind].hideConversation)
  }, [])
  const close = useCallback(() => setOpen(null), [])
  const toggleConversation = useCallback(() => setConversationHidden((h) => !h), [])
  const value = useMemo(
    () => ({ open, openTool, close, target, conversationHidden, toggleConversation }),
    [open, openTool, close, target, conversationHidden, toggleConversation],
  )

  // the divider: drag, arrow keys (5% a press), double-click for the tool's starting width
  const setSplit = (next: number) => {
    const w = row.current?.getBoundingClientRect().width ?? 0
    if (!w) return
    setPct(Math.min(100 - (MIN_CONVERSATION / w) * 100, Math.max((MIN_TOOL / w) * 100, next)))
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
      <div ref={row} className="flex h-full min-h-0">
        {/* hidden, not removed: the answer that owns the tool stays mounted */}
        <div className={cn('h-full min-w-0 flex-1', open && !narrow && conversationHidden && 'hidden')}>
          {children}
        </div>
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

/** The open tool's frame, rendered into the tool view: header (show/hide conversation, icon, title, the tool's
 * own actions, Close) and the body. Render it only while the tool is open. */
export function ToolViewFrame(props: { icon: ReactNode; title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const ctx = useContext(Context)
  const narrow = useIsMobile()
  if (!ctx?.target) return null
  const tip = ctx.conversationHidden ? 'Show conversation' : 'Hide conversation'
  return createPortal(
    <>
      <div className="@container flex h-10 shrink-0 items-center gap-2 border-b px-2 text-xs">
        {!narrow && (
          <TooltipIconButton tooltip={tip} side="bottom" className="size-7 p-1.5" onClick={ctx.toggleConversation}>
            {ctx.conversationHidden ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </TooltipIconButton>
        )}
        <span className="text-muted-foreground flex size-4 shrink-0 items-center [&>svg]:size-4">{props.icon}</span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate">{props.title}</span>
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
        className="m-3 flex items-end gap-2 rounded-2xl border px-3 py-2"
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
          className="max-h-32 min-h-6 flex-1 resize-none bg-transparent outline-none"
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
