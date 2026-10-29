import { createLocalStorageAdapter } from '@assistant-ui/core/react'
import {
  AssistantRuntimeProvider,
  AuiConfig,
  AuiProvider,
  createSimpleTitleAdapter,
  Suggestions,
  useAui,
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from '@assistant-ui/react'
import { useState, type ReactNode } from 'react'

import { Thread } from '@/components/assistant-ui/elements/thread.aui'
import { BdcMessageParts } from '@/components/bdc/message-parts'
import { NewConversation } from '@/components/bdc/new-conversation'
import { ThemeToggle } from '@/components/bdc/theme-toggle'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createBdcAdapter, type Reveal } from '@/lib/bdc-adapter'
import {
  browserStorage,
  createConversationStorage,
  readOpenConversation,
  saveOpenConversation,
  STORAGE_PREFIX,
} from '@/lib/conversation-storage'

// demo_services.sh runs bdc-assist on :8010; the stub server is on :8011
const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8010'
// ?reveal=after-check (or VITE_REVEAL) holds the answer back until it's checked
const REVEAL: Reveal =
  (new URLSearchParams(location.search).get('reveal') ?? import.meta.env.VITE_REVEAL) ===
  'after-check'
    ? 'after-check'
    : 'stream'
const adapter = createBdcAdapter(API_URL, { reveal: REVEAL })
// several conversations, saved in this browser; each is titled with its first question
const storage = browserStorage()
const conversations = createLocalStorageAdapter({
  storage: createConversationStorage(storage),
  prefix: STORAGE_PREFIX,
  titleGenerator: createSimpleTitleAdapter(),
})

// the runtime for one conversation; the thread list supplies its history adapter
function useConversationRuntime() {
  return useLocalRuntime(adapter)
}

// shown on the empty thread; clicking one sends it
const STARTERS = [
  'What is BDC?',
  'Can I upload my own data to BDC?',
  'Does BDC have COVID data?',
  'What are the latest BDC events?',
]

function Starters({ children }: { children: ReactNode }) {
  const aui = useAui()
  return (
    <AuiProvider extends={aui} config={AuiConfig({ suggestions: Suggestions(STARTERS) })}>
      {children}
    </AuiProvider>
  )
}

export default function App() {
  // a reload reopens the conversation that was open
  const [threadId, setThreadId] = useState(() => readOpenConversation(storage))
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: useConversationRuntime,
    adapter: conversations,
    threadId,
    onThreadIdChange: (id) => {
      setThreadId(id)
      saveOpenConversation(storage, id)
    },
  })
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <BdcMessageParts />
      <Starters>
        <TooltipProvider>
          <div className="relative h-dvh">
            <Thread />
            <NewConversation />
            <ThemeToggle />
          </div>
        </TooltipProvider>
      </Starters>
    </AssistantRuntimeProvider>
  )
}
