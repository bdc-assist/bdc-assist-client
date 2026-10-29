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

/** `storage` for the thread-list adapter. Where storage is missing or a write
 * fails (private mode, blocked site data, full), the value is kept in memory
 * instead: conversations still work, they just aren't kept after a reload. */
export function createConversationStorage(storage: Storage | null): AsyncStorageLike {
  // values that couldn't be written; newer than whatever storage holds
  const memory = new Map<string, string>()
  try {
    storage?.removeItem(OLD_KEY)
  } catch {
    // nothing to forget
  }
  return {
    async getItem(key) {
      if (memory.has(key)) return memory.get(key)!
      try {
        return storage?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    async setItem(key, value) {
      try {
        if (!storage) throw new Error('no storage')
        storage.setItem(key, value)
        memory.delete(key)
      } catch {
        memory.set(key, value)
      }
    },
    async removeItem(key) {
      memory.delete(key)
      try {
        storage?.removeItem(key)
      } catch {
        // gone from memory at least
      }
    },
  }
}
