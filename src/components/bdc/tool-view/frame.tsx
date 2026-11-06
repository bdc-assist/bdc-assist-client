import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, ChevronsLeftIcon, ChevronsRightIcon, XIcon } from 'lucide-react'
import { useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import { CHAT_WIDTH, ToolChat, type ToolChatProps } from './chat'
import { Context, showCard } from './context'
import { MIN_TOOL, TOOLS, type ToolKind } from './tools'

// the tool's chat goes to the right of the object when the tool view has room for both, else below it
const CHAT_RIGHT_MIN = MIN_TOOL + CHAT_WIDTH

/** The open tool's frame, rendered into the tool view. Its header, the same for every tool: show the card in the
 * conversation (while it's out of sight), expand to full width / show conversation, the tool's icon and `name`
 * (default: the tool's), Edited (a menu with Reset to original) and the `summary`, then Undo/Redo and the tool's
 * own action (`actions`), Close. Then the object (`children`) and its `chat`: to the right when the tool view is at
 * least CHAT_RIGHT_MIN wide (apart from the conversation's composer, and the object keeps its full height), else
 * below. Render it only while the tool is open. */
export function ToolViewFrame(props: {
  kind: ToolKind
  name?: string
  summary?: string
  edited?: boolean
  onReset?: () => void
  actions?: ReactNode
  chat?: ToolChatProps
  children: ReactNode
}) {
  const ctx = useContext(Context)
  const narrow = useIsMobile()
  const [menu, setMenu] = useState(false)
  // the tool view's width, for where the chat goes
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    observer.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.current.observe(el)
  }, [])
  if (!ctx?.target) return null
  const right = width >= CHAT_RIGHT_MIN
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
        {/* when it's short of room: the summary goes first, then the name shortens; Edited (the way to Reset)
            always shows. Clipped, so nothing draws under Undo/Redo */}
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span className="min-w-0 shrink truncate text-sm font-medium">{props.name ?? name}</span>
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
          {props.summary && <span className="text-muted-foreground min-w-0 shrink-[1000] truncate">{props.summary}</span>}
        </span>
        {props.actions}
        <TooltipIconButton tooltip="Close" side="bottom" className="size-7 p-1.5" onClick={ctx.close}>
          <XIcon />
        </TooltipIconButton>
      </div>
      <div ref={measure} className={cn('flex min-h-0 flex-1', right ? 'flex-row' : 'flex-col')}>
        {/* the tool itself (graph, form) on a white sheet, inset in the panel's grey with the chat */}
        <div className="bg-background m-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
          {props.children}
        </div>
        {props.chat && <ToolChat {...props.chat} placement={right ? 'right' : 'below'} />}
      </div>
    </>,
    ctx.target,
  )
}
