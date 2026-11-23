// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import type { FormDef } from '@/lib/forms'
import { Busy } from '@/lib/side-panel'

import { chatBody, failureText } from './use-form-draft'

const GH: FormDef = {
  id: 'get-help',
  title: 'Get Help',
  url: 'https://bdc/help/get-help/',
  fields: [
    { name: 'requester', label: 'Email', kind: 'text', required: true, personal: true },
    { name: 'cf_subject', label: 'Subject', kind: 'text', required: true },
  ],
}

describe('chatBody', () => {
  it('never carries personal values or names', () => {
    const draft = { values: { requester: 'a@b.org', cf_subject: 'Login' }, changed: [], edited: ['requester', 'cf_subject'] }
    const messages = [{ role: 'user' as const, text: 'shorter' }]
    const body = chatBody(GH, draft, messages, { summary: 'S', question: 'Q' })
    expect(body).toEqual({ values: { cf_subject: 'Login' }, edited: ['cf_subject'], messages, summary: 'S', question: 'Q' })
    expect(JSON.stringify(body)).not.toContain('a@b.org')
  })
})

describe('failureText', () => {
  it('says busy, or that it failed, and that the fields still work on the first draft', () => {
    expect(failureText(new Busy(), true)).toMatch(/busy/)
    expect(failureText(new Busy(), true)).toMatch(/fill in the fields yourself/i)
    expect(failureText(new Error('x'), false)).not.toMatch(/busy/)
  })
})
