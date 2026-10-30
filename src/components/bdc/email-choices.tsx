import { useAuiState } from '@assistant-ui/react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { drawnGraph, renderImage, type KgGraph } from '@/kg'
import type { GraphPartData } from '@/lib/bdc-adapter'
import { graphCount, graphsOf, toEmail, turnsOf, type Email, type EmailGraph } from '@/lib/email-export'
import { shownGraph } from '@/lib/shown-graphs'

// The Email dialog's contents (see email-conversation.tsx). Its own module, loaded when the
// dialog first opens: making the email (react-dom/server, react-markdown) is ~200 kB.

type Scope = 'single' | 'full'
type Choices = { scope: Scope; graphs: boolean }
const KEY = 'bdc-email' // the last choices, in this browser

function remembered(): Choices {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Choices>
    return { scope: saved.scope === 'full' ? 'full' : 'single', graphs: saved.graphs ?? true }
  } catch {
    return { scope: 'single', graphs: true }
  }
}
function remember(choices: Choices) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choices))
  } catch {
    // not remembered: fine
  }
}

/**
 * How a graph goes in: as its panel shows it (view, options, Force layout), drawn off screen in
 * the light palette on white (one image has to read in light and dark mail clients); List
 * as the table of its studies. A panel never drawn (none so far): Force, as panels start.
 */
async function embed(answerGraph: KgGraph): Promise<EmailGraph> {
  const how = shownGraph(answerGraph)
  const view = how?.view ?? 'force'
  if (view === 'list') return { table: true }
  const graph = how?.graph ?? answerGraph
  const options = {
    ...how?.options,
    // a copy: Force writes into it
    forcePositions: how && new Map(how.forcePositions),
    ...(view === 'flow' && flowBox(graph)),
  }
  try {
    return { image: await renderImage(graph, view, options), view }
  } catch (err) {
    console.error('graph image failed', err)
    return { table: true }
  }
}

// Flow lays out for its box exactly: tall enough for its longer column
function flowBox(graph: KgGraph) {
  const drawn = drawnGraph(graph)
  const column = Math.max(...(['concept', 'study'] as const).map((t) => drawn.nodes.filter((n) => n.type === t).length))
  return { width: 720, height: Math.min(900, Math.max(240, column * 22 + 40)) }
}

/** Each of `graphs` as it goes in, drawn while the dialog is open (so copying, on a click,
 * doesn't wait: Safari only lets a click write to the clipboard straight away). */
function useEmbeds(graphs: readonly KgGraph[]) {
  // kept while the dialog is open, so switching the scope back draws nothing again
  const [cache] = useState(() => new Map<KgGraph, EmailGraph>())
  const [, drawn] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    let current = true
    void (async () => {
      for (const g of graphs) {
        if (cache.has(g)) continue
        cache.set(g, await embed(g))
        if (!current) return // other graphs wanted now: that run carries on
        drawn()
      }
    })()
    return () => {
      current = false
    }
  }, [graphs, cache])
  return { embeds: cache, ready: graphs.every((g) => cache.has(g)) }
}

async function copy({ html, text }: Email) {
  if (typeof ClipboardItem === 'undefined') return navigator.clipboard.writeText(text)
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ])
}

export default function EmailChoices({ answerId, onClose }: { answerId: string; onClose: () => void }) {
  const messages = useAuiState((s) => s.thread.messages)
  const title = useAuiState((s) => s.threads.threadItems.find((t) => t.id === s.threads.mainThreadId)?.title ?? '')
  const [choices, setChoices] = useState(remembered)

  const answers = messages.filter((m) => m.role === 'assistant').length
  const scope: Scope = answers > 1 ? choices.scope : 'single'
  const turns = useMemo(() => turnsOf(messages, scope, answerId), [messages, scope, answerId])
  const graphs = graphCount(turns)
  const wanted = useMemo(() => (choices.graphs ? graphsOf(turns) : []), [turns, choices.graphs])
  const { embeds, ready } = useEmbeds(wanted)

  async function send(open: boolean) {
    remember(choices)
    const graph = (data: GraphPartData) => embeds.get(data.graph)
    const email = toEmail(turns, { title, date: new Date(), graphs: choices.graphs, graph })
    try {
      await copy(email)
    } catch {
      toast.error("Couldn't copy. Try again.")
      return
    }
    onClose()
    toast.success(open ? 'Copied. Paste it into the new message.' : 'Copied. Paste it into an email.')
    if (open) window.location.href = `mailto:?subject=${encodeURIComponent(email.subject)}`
  }

  const radio = (value: Scope, label: string) => (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="radio"
        name="email-scope"
        className="accent-primary"
        checked={scope === value}
        onChange={() => setChoices({ ...choices, scope: value })}
      />
      {label}
    </label>
  )

  return (
    <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle>Email</DialogTitle>
      </DialogHeader>
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1.5 font-medium">Include</legend>
        {radio('single', 'This question and answer')}
        {answers > 1 && radio('full', `Whole conversation (${answers} questions)`)}
      </fieldset>
      {graphs > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={choices.graphs}
            onChange={(e) => setChoices({ ...choices, graphs: e.target.checked })}
          />
          {graphs > 1 ? `Include knowledge graphs (${graphs})` : 'Include knowledge graph'}
        </label>
      )}
      <DialogFooter className="sm:items-center">
        <Button
          variant="link"
          className="text-muted-foreground sm:mr-auto sm:px-0"
          disabled={!ready}
          onClick={() => send(false)}
        >
          Copy only
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!ready} onClick={() => send(true)}>
          {ready ? 'Copy and open email' : 'Drawing graphs…'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
