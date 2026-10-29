import type { AsyncStorageLike } from '@assistant-ui/core/react'

// Saved conversations stay in the browser. assistant-ui's localStorage thread-list adapter keeps
// the list at `${STORAGE_PREFIX}threads` and each conversation's messages at
// `${STORAGE_PREFIX}messages:<id>`; this is the storage it writes through.

export const STORAGE_PREFIX = 'bdc-assist:'

// the one conversation kept before there was a list: dropped, not migrated
const OLD_KEY = 'bdc-assist:thread:v1'

/** The browser's localStorage, or null where it's unavailable (merely reading
 * it throws when site data is blocked). */
export function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// the conversation open at the last visit, reopened on load
const OPEN_KEY = `${STORAGE_PREFIX}open`

/** The id of the conversation that was open last, if any. */
export function readOpenConversation(storage: Storage | null): string | undefined {
  try {
    return storage?.getItem(OPEN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Remembers the open conversation; none for a new one that has no messages yet. */
export function saveOpenConversation(storage: Storage | null, id: string | undefined) {
  try {
    if (id) storage?.setItem(OPEN_KEY, id)
    else storage?.removeItem(OPEN_KEY)
  } catch {
    // not remembered: the next visit starts a new conversation
  }
}

/** Where a conversation's messages are kept (the adapter's key for them). */
export const messagesKey = (remoteId: string) => `${STORAGE_PREFIX}messages:${remoteId}`

/** About how much localStorage a site gets, in characters (browsers count UTF-16 code units). */
export const STORAGE_QUOTA = 5 * 1024 * 1024

/** Whether saving is stuck on a full storage, and how many characters the unsaved writes
 * add: about what has to be freed, since a full storage has next to nothing left. A new
 * object only when it changes (for useSyncExternalStore). */
export type StorageStatus = { full: boolean; needed: number }

export type ConversationStorage = AsyncStorageLike & {
  status(): StorageStatus
  subscribe(listener: () => void): () => void
  /** A key's current value, unsaved or stored, read synchronously. */
  peek(key: string): string | null
  /** Characters this site's localStorage holds (keys and values). */
  usage(): number
}

/** A write refused because storage is full (Firefox has its own name for it). */
function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/** `storage` for the thread-list adapter. Where storage is missing or a write
 * fails (private mode, blocked site data, full), the value is kept in memory
 * instead: conversations still work, they just aren't kept after a reload.
 * When a write fails because storage is full, the status says so, and every
 * removal retries the unsaved writes, so freeing space saves them. */
export function createConversationStorage(storage: Storage | null): ConversationStorage {
  // values that couldn't be written; newer than whatever storage holds
  const memory = new Map<string, string>()
  const listeners = new Set<() => void>()
  let status: StorageStatus = { full: false, needed: 0 }
  try {
    storage?.removeItem(OLD_KEY)
  } catch {
    // nothing to forget
  }

  const stored = (key: string) => {
    try {
      return storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const setStatus = (full: boolean) => {
    // the unsaved values, less what they'd replace
    let needed = 0
    if (full) for (const [k, v] of memory) needed += k.length + v.length - (stored(k)?.length ?? 0)
    if (full === status.full && needed === status.needed) return
    status = { full, needed: Math.max(needed, 0) }
    for (const l of listeners) l()
  }
  // writes `value`, or keeps it in memory when it can't be written (and says why)
  const write = (key: string, value: string): 'ok' | 'full' | 'failed' => {
    try {
      if (!storage) throw new Error('no storage')
      storage.setItem(key, value)
      memory.delete(key)
      return 'ok'
    } catch (err) {
      memory.set(key, value)
      return isQuotaError(err) ? 'full' : 'failed'
    }
  }
  const retry = () => {
    if (!status.full) return
    let full = false
    for (const [k, v] of [...memory]) if (write(k, v) === 'full') full = true
    setStatus(full)
  }

  return {
    async getItem(key) {
      return memory.has(key) ? memory.get(key)! : stored(key)
    },
    async setItem(key, value) {
      if (write(key, value) === 'full') setStatus(true)
      else retry() // it fit: maybe the earlier ones do now too
    },
    async removeItem(key) {
      memory.delete(key)
      try {
        storage?.removeItem(key)
      } catch {
        // gone from memory at least
      }
      retry()
    },
    status: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    peek: (key) => (memory.has(key) ? memory.get(key)! : stored(key)),
    usage() {
      let n = 0
      try {
        for (let i = 0; i < (storage?.length ?? 0); i++) {
          const k = storage!.key(i)
          if (k !== null) n += k.length + (storage!.getItem(k)?.length ?? 0)
        }
      } catch {
        // unreadable: count nothing
      }
      return n
    },
  }
}
