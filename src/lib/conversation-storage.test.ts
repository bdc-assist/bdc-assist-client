import { describe, expect, it } from 'vitest'

import {
  createConversationStorage,
  readOpenConversation,
  saveOpenConversation,
} from '@/lib/conversation-storage'

/** Just enough of the Storage interface, backed by a Map; `full` makes writes throw. */
function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries))
  const s = {
    full: false,
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (s.full) throw new DOMException('full', 'QuotaExceededError')
      map.set(k, v)
    },
    removeItem: (k: string) => void map.delete(k),
  }
  return s
}

describe('createConversationStorage', () => {
  it('reads and writes through to storage', async () => {
    const backing = memoryStorage()
    const storage = createConversationStorage(backing as unknown as Storage)
    await storage.setItem('a', '1')
    expect(backing.map.get('a')).toBe('1')
    expect(await storage.getItem('a')).toBe('1')
    await storage.removeItem('a')
    expect(await storage.getItem('a')).toBeNull()
  })

  it('drops the old single conversation', () => {
    const backing = memoryStorage({ 'bdc-assist:thread:v1': '{}', other: 'x' })
    createConversationStorage(backing as unknown as Storage)
    expect([...backing.map.keys()]).toEqual(['other'])
  })

  it('keeps a failed write in memory, newer than storage', async () => {
    const backing = memoryStorage({ a: 'old' })
    const storage = createConversationStorage(backing as unknown as Storage)
    backing.full = true
    await storage.setItem('a', 'new')
    expect(backing.map.get('a')).toBe('old')
    expect(await storage.getItem('a')).toBe('new')
    // once a write lands, storage is current again
    backing.full = false
    await storage.setItem('a', 'newer')
    backing.map.set('a', 'changed elsewhere')
    expect(await storage.getItem('a')).toBe('changed elsewhere')
  })

  it('works in memory without storage', async () => {
    const storage = createConversationStorage(null)
    await storage.setItem('a', '1')
    expect(await storage.getItem('a')).toBe('1')
    await storage.removeItem('a')
    expect(await storage.getItem('a')).toBeNull()
  })
})

describe('open conversation', () => {
  it('remembers the open conversation, and forgets it for a new one', () => {
    const backing = memoryStorage() as unknown as Storage
    expect(readOpenConversation(backing)).toBeUndefined()
    saveOpenConversation(backing, 'abc')
    expect(readOpenConversation(backing)).toBe('abc')
    saveOpenConversation(backing, undefined)
    expect(readOpenConversation(backing)).toBeUndefined()
  })

  it('does without storage', () => {
    saveOpenConversation(null, 'abc')
    expect(readOpenConversation(null)).toBeUndefined()
  })
})
