import { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react'

import type { ToolKind } from './tools'

export type ToolViewContext = {
  open: { owner: string; kind: ToolKind } | null
  openTool: (owner: string, kind: ToolKind) => void
  close: () => void
  target: HTMLElement | null // where the open tool renders
  conversationHidden: boolean
  toggleConversation: () => void
  cardOff: 'up' | 'down' | null // where the open tool's card is while it's out of sight in the conversation
  // for ToolSplit, which draws the tool view
  setTarget: (el: HTMLElement | null) => void
  setCardOff: (off: 'up' | 'down' | null) => void
}

export const Context = createContext<ToolViewContext | null>(null)

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

/** Put on the open tool's card in the answer (its header row): where the card is, for its triangle and the
 * show-in-conversation button. */
export const TOOL_ANCHOR = { 'data-tool-anchor': '' }

/** Scrolls the open tool's card into the middle of the conversation and briefly tints it. */
export function showCard() {
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
