import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FormValues } from '@/lib/forms'

import { demoFirstDraft, demoFormSuggestion, demoRevise } from './demo-drafts'

// the demo waits as if an agent were working: skip the waits
beforeEach(() => void vi.useFakeTimers())
afterEach(() => void vi.useRealTimers())
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return p
}

const first = () => settle(demoFirstDraft())
const revise = (text: string, values: FormValues, edited: string[] = []) => settle(demoRevise(text, values, edited))

describe('demoFirstDraft', () => {
  it('drafts the login loop, leaving name and email for the user', async () => {
    const { values, reply } = await first()
    expect(values.ticket_type).toBe('Login Issue')
    expect(values.cf_subject).toBeTruthy()
    expect(values.cf_requestors_name).toBeUndefined()
    expect(values.requester).toBeUndefined()
    expect(reply).toMatch(/platform/)
  })

  it('is blank when there is nothing to draft from', async () => {
    const { values, reply } = await settle(demoFirstDraft(true))
    expect(values).toEqual({})
    expect(reply).toMatch(/What do you need help with/)
  })
})

describe('demoFormSuggestion', () => {
  it('offers the platform, then shortening, then nothing', async () => {
    const draft = (await first()).values
    expect(demoFormSuggestion(draft)).toMatch(/Terra/)
    const withPlatform = (await revise(demoFormSuggestion(draft)!, draft)).values
    expect(demoFormSuggestion(withPlatform)).toBe('Make the description shorter.')
    const short = (await revise('Make the description shorter.', withPlatform)).values
    expect(demoFormSuggestion(short)).toBeNull()
  })

  it('offers nothing for a blank draft', () => {
    expect(demoFormSuggestion({})).toBeNull()
  })
})

describe('demoRevise', () => {
  it('rewrites the description with the platform, browser and cookies', async () => {
    const draft = (await first()).values
    const { values, reply } = await revise("It's Terra, in Firefox. I already tried clearing cookies.", draft)
    expect(values.cf_submitted_description).toBe(
      'When I log in to Terra through eRA Commons in Firefox, I am sent back to the login page instead of being ' +
        'signed in. Clearing cookies did not help.',
    )
    expect(reply).toBe('Updated the description.')
  })

  it('shortens, and keeps what it knew from the description', async () => {
    const draft = (await first()).values
    const terra = (await revise('Terra, in Chrome', draft)).values
    const { values, reply } = await revise('shorter please', terra)
    expect(values.cf_submitted_description).toBe('eRA Commons login on Terra (Chrome) loops back to the login page.')
    expect(reply).toBe('Shortened the description.')
    // stays short when more comes in later
    const later = (await revise('I tried clearing cookies', values)).values
    expect(later.cf_submitted_description).toBe(
      'eRA Commons login on Terra (Chrome) loops back to the login page. Clearing cookies did not help.',
    )
  })

  it('fills in an email, a name and a research community', async () => {
    const { values, reply } = await revise('My name is Ada Lovelace, ada@example.org, with TOPMed', {})
    expect(values).toMatchObject({
      cf_requestors_name: 'Ada Lovelace',
      requester: 'ada@example.org',
      cf_research_community: 'TOPMed',
    })
    expect(reply).toBe('Added your email. Added your name. Set the research community to TOPMed.')
    // lower case too
    expect((await revise('my name is Ada', {})).values.cf_requestors_name).toBe('Ada')
  })

  it('keeps fields it was not asked about, including the user\'s own edits', async () => {
    const draft: FormValues = { ...(await first()).values, cf_subject: 'My own subject' }
    const { values, reply } = await revise('It was Seven Bridges', draft, ['cf_subject'])
    expect(values.cf_subject).toBe('My own subject')
    expect(values.ticket_type).toBe(draft.ticket_type)
    expect(reply).toBe('Updated the description. I kept your subject.')
  })

  it('says when name and email stay blank', async () => {
    const draft = (await first()).values
    const { reply } = await revise('Terra. Leave my name and email off.', draft)
    expect(reply).toBe('Updated the description. Name and email stay blank.')
  })

  it('changes nothing and says what it understands otherwise', async () => {
    const draft = (await first()).values
    const { values, reply } = await revise('hello?', draft)
    expect(values).toBe(draft)
    expect(reply).toMatch(/This demo understands/)
  })
})
