import { useEffect, useRef, type RefObject } from 'react'

// A small triangle on the open tool's card in the conversation, just off its right edge and halfway down, pointing
// to the tool, in the open card's border colour (design/tool-view.html), so it's clear which answer the tool belongs
// to. Once all of the card is out of sight (scrolled away, or under the composer) the tool's header shows a small
// button pointing up or down to it (`onOff`), which scrolls it into view (showCard); until then the triangle sits
// halfway down the part of the card that shows.
// Measured every frame while shown: the card moves with scrolling, streaming answers, the divider and the window,
// and a frame loop is simpler than observing all of those. Written to the DOM directly; only where the card is
// (in sight, above, below) is React state, set when it changes.
const TAB_GAP = 4 // px between the card's right edge and the triangle

export function CardPointer({
  row,
  onOff,
}: {
  row: RefObject<HTMLDivElement | null>
  onOff: (off: 'up' | 'down' | null) => void
}) {
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
      // the whole card, for both whether it's in sight and where the triangle goes
      const card = (anchor?.closest('[data-tool-card]') ?? anchor)?.getBoundingClientRect()
      const top = viewport?.getBoundingClientRect().top ?? box.top
      const bottom = footer?.getBoundingClientRect().top ?? box.bottom
      // out of sight only once all of it is: above the conversation's top, or under the composer
      const now = !card || !head ? null : card.bottom <= top ? 'up' : card.top >= bottom ? 'down' : null
      if (now !== off) onOff((off = now))
      if (!card || !head || now) {
        el.style.visibility = 'hidden'
        return
      }
      // halfway down the part of the card that shows: the whole card's middle while it's all in sight, then
      // following what's left of it as it scrolls away, until the button takes over
      const y = (Math.max(card.top, top) + Math.min(card.bottom, bottom)) / 2
      const x = card.right - box.left + TAB_GAP
      const yc = y - box.top
      el.firstElementChild?.setAttribute('points', `${x},${yc - 7} ${x + 7},${yc} ${x},${yc + 7}`)
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
      <polygon className="fill-muted-foreground" />
    </svg>
  )
}
