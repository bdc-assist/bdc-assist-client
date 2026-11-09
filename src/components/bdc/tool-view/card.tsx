import { ChevronsDownUpIcon, ChevronsUpDownIcon, ChevronRightIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { TOOL_ANCHOR } from './context'
import { TOOLS, type ToolKind } from './tools'

/** An object's card in the answer, the same for every tool: a header row (icon, `name` (default: the tool's),
 * Edited, `status` (e.g. "Drafting…"), and a labelled button to open its tool (TOOLS' `open`, e.g. "Edit form"),
 * gone while it's open) and a `summary` line.
 * An object with an inline view (the graph) passes it as `children`, shown under the same two rows while its tool
 * is closed, so opening the tool reads as the view shrinking to its card. A card with an inline view folds it
 * away and back: by its chevron, or a click anywhere on the header row or the summary (as the old graph panel's
 * <details> did). While open: a darker border, and the triangle off its right edge (CardPointer). */
export function ToolCard(props: {
  kind: ToolKind
  name?: string
  summary?: string | null
  edited?: boolean
  status?: ReactNode
  isOpen: boolean
  onOpen?: () => void
  children?: ReactNode
}) {
  const { icon: Icon, name, open } = TOOLS[props.kind]
  const [folded, setFolded] = useState(false)
  const foldable = Boolean(props.children) && !props.isOpen
  const fold = foldable ? () => setFolded((f) => !f) : undefined
  return (
    <div data-tool-card className={cn('my-3 rounded-lg border text-sm', props.isOpen && 'border-muted-foreground')}>
      <div
        {...(props.isOpen && TOOL_ANCHOR)}
        onClick={fold}
        className={cn('flex h-9 items-center gap-2 pr-1 pl-3', foldable && 'cursor-pointer select-none')}
      >
        <Icon className="text-muted-foreground size-4 shrink-0" />
        {/* short of room: the name shortens, Edited stays (as in the tool's header) */}
        <span className="min-w-0 truncate font-medium">{props.name ?? name}</span>
        {props.edited && (
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 text-[11px] leading-[18px]">
            Edited
          </span>
        )}
        {props.status}
        <span className="flex-1" />
        {foldable && (
          <TooltipIconButton
            tooltip={folded ? 'Expand' : 'Collapse'}
            side="left"
            className="size-7 p-1.5"
            onClick={(e) => {
              e.stopPropagation() // the header row folds too
              setFolded((f) => !f)
            }}
          >
            {/* double chevrons change size, as the header's change the width: in to fold, out to unfold */}
            {folded ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
          </TooltipIconButton>
        )}
        {props.onOpen && !props.isOpen && (
          // labelled, with a chevron after it: as a bare panel icon it read as a layout toggle, not as opening the object
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation() // not a fold
                  props.onOpen?.()
                }}
              >
                {open}
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Open in side panel</TooltipContent>
          </Tooltip>
        )}
      </div>
      {props.summary && (
        <p
          onClick={fold}
          className={cn(
            'text-muted-foreground -mt-1.5 truncate px-3 pb-2 text-xs',
            foldable && 'cursor-pointer select-none',
          )}
        >
          {props.summary}
        </p>
      )}
      {/* folded: hidden, not unmounted, so the inline view keeps its state */}
      {!props.isOpen && props.children && <div hidden={folded}>{props.children}</div>}
    </div>
  )
}
