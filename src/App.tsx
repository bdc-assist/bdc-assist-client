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
import { ThreadListSidebar } from '@/components/assistant-ui/elements/threadlist-sidebar.aui'
import { BdcMessageParts } from '@/components/bdc/message-parts'
import { ChatHeader } from '@/components/bdc/chat-header'
import { ConversationSwitch } from '@/components/bdc/conversation-switch'
import { useSidebarOpen } from '@/components/bdc/sidebar-toggle'
import { StorageFullDialog } from '@/components/bdc/storage-full-dialog'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
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
const conversationStorage = createConversationStorage(storage)
const conversations = createLocalStorageAdapter({
  storage: conversationStorage,
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
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen()
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <BdcMessageParts />
      <Starters>
        <TooltipProvider>
          <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <ThreadListSidebar />
            <ConversationSwitch />
            <SidebarInset className="h-dvh">
              <ChatHeader />
              <div className="min-h-0 flex-1">
                <Thread />
              </div>
            </SidebarInset>
            <StorageFullDialog storage={conversationStorage} />
          </SidebarProvider>
        </TooltipProvider>
      </Starters>
    </AssistantRuntimeProvider>
  )
}
