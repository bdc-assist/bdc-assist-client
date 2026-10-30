import { useAuiState } from '@assistant-ui/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { graphCount, toEmail, turnsOf, type Email, type EmailGraph } from '@/lib/email-export'

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

// Until graphs can be drawn as images, every graph goes in as the table of its studies
// (as the List view would)
const graphEmbed = (): EmailGraph => ({ table: true })

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
  const turns = turnsOf(messages, scope, answerId)
  const graphs = graphCount(turns)

  async function send(open: boolean) {
    remember(choices)
    const email = toEmail(turns, { title, date: new Date(), graphs: choices.graphs, graph: graphEmbed })
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
        <Button variant="link" className="text-muted-foreground sm:mr-auto sm:px-0" onClick={() => send(false)}>
          Copy only
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => send(true)}>Copy and open email</Button>
      </DialogFooter>
    </DialogContent>
  )
}
