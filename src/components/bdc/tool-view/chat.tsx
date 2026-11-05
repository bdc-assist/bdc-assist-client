import { ArrowUpIcon, CornerDownRightIcon, LoaderIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { cn } from '@/lib/utils'

export const CHAT_WIDTH = 280 // px, when it's to the right of the object

export type ToolMessage = { role: 'user' | 'tool'; text: string }

export type ToolChatProps = {
  what: string // "graph", "draft": for the hint and the placeholder
  messages: ToolMessage[]
  suggestion?: string | null // a message to offer as a button, above the composer
  busy?: boolean // a change is being made
  onSend: (text: string) => void
}

/** The tool's own chat: its messages change the object in place and don't appear in the conversation. To the right
 * of the object it has the height for every message; below it, the last exchange shows and earlier ones fold
 * ("Show earlier"). The hint shows only before the first message. */
export function ToolChat(props: ToolChatProps & { placement: 'right' | 'below' }) {
  const [text, setText] = useState('')
  const [showEarlier, setShowEarlier] = useState(false)
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
  const right = props.placement === 'right'
  // the last exchange: from the last message the user sent (or the last message, before they've sent any)
  const lastUser = props.messages.findLastIndex((m) => m.role === 'user')
  const from = right || showEarlier ? 0 : Math.max(0, lastUser >= 0 ? lastUser : props.messages.length - 1)
  const earlier = right ? null : from > 0 ? `Show earlier (${from})` : showEarlier && lastUser > 0 ? 'Hide earlier' : null
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col text-sm',
        right ? 'shrink-0 border-l' : 'max-h-[45%] shrink-0 border-t',
      )}
      style={right ? { width: CHAT_WIDTH } : undefined}
    >
      <div className={cn('flex min-h-0 flex-col gap-2 overflow-y-auto px-3 pt-2', right && 'flex-1')}>
        {props.messages.length === 0 && !props.busy && (
          <p className={cn('text-muted-foreground text-xs', right && 'mt-auto')}>
            Messages here change this {props.what} in place. They don&apos;t appear in the conversation.
          </p>
        )}
        {earlier && (
          <button
            type="button"
            onClick={() => setShowEarlier((v) => !v)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground self-center rounded-md px-1.5 py-0.5 text-xs"
          >
            {earlier}
          </button>
        )}
        {props.messages.slice(from).map((m, i) =>
          m.role === 'user' ? (
            <div key={from + i} className="bg-muted self-end rounded-2xl px-3 py-1.5">
              {m.text}
            </div>
          ) : (
            <p key={from + i}>{m.text}</p>
          ),
        )}
        {props.busy && (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <LoaderIcon className="size-3.5 animate-spin" />
            Working…
          </p>
        )}
        <div ref={end} />
      </div>
      {props.suggestion && !props.busy && (
        <button
          type="button"
          onClick={() => send(props.suggestion!)}
          className="text-muted-foreground hover:bg-muted hover:text-foreground mx-1.5 mt-2 flex items-center gap-1.5 self-start rounded-md px-1.5 py-0.5 text-start"
        >
          <CornerDownRightIcon className="size-3.5 shrink-0" />
          {props.suggestion}
        </button>
      )}
      <form
        // the thread's composer box (thread.aui.tsx); its --composer-bg is set on the thread, so repeated here
        className="border-foreground/10 focus-within:border-foreground/25 m-3 flex shrink-0 items-end gap-2 rounded-2xl border bg-[color-mix(in_oklab,var(--color-muted)_30%,transparent)] px-3 py-2 transition-[border-color]"
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
