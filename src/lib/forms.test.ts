import { describe, expect, it } from 'vitest'

import { formById, formForSources, formUrl, GET_HELP, shownFields } from '@/lib/forms'

const source = (link: string) => ({ title: 'Page', link, type: 'page' })

describe('formForSources', () => {
  it('finds the form whose page an answer cites, in any source group', () => {
    expect(formForSources({ 'bdc-doc': [source('https://x/overview')], other: [source(GET_HELP.url)] })).toBe(GET_HELP)
  })

  it('ignores a trailing slash either way', () => {
    expect(formForSources({ 'bdc-doc': [source(GET_HELP.url.replace(/\/$/, ''))] })).toBe(GET_HELP)
    expect(formForSources({ 'bdc-doc': [source(`${GET_HELP.url}//`)] })).toBe(GET_HELP)
  })

  it('finds none for other pages, empty or no sources', () => {
    expect(formForSources({ 'bdc-doc': [source('https://biodatacatalyst.nhlbi.nih.gov/help/')] })).toBeNull()
    expect(formForSources({ 'bdc-doc': [source(`${GET_HELP.url}more/`)] })).toBeNull()
    expect(formForSources({})).toBeNull()
    expect(formForSources(null)).toBeNull()
  })
})

describe('formById', () => {
  it('looks forms up by id', () => {
    expect(formById('get-help')).toBe(GET_HELP)
    expect(formById('nope')).toBeNull()
  })
})

describe('shownFields', () => {
  const names = (values: Record<string, string>) => shownFields(GET_HELP, values).map((f) => f.name)

  it("shows a type's own section only when that type is chosen", () => {
    expect(names({})).not.toContain('cf_journal_name')
    expect(names({ ticket_type: 'Login Issue' })).not.toContain('cf_journal_name')
    expect(names({ ticket_type: 'Publishing Research' })).toEqual(
      expect.arrayContaining(['cf_paper_title_or_working_title', 'cf_journal_name']),
    )
  })

  it('keeps the fields in the form order', () => {
    const all = GET_HELP.fields.map((f) => f.name)
    const shown = names({ ticket_type: 'Publishing Research' })
    expect(shown).toEqual(all)
  })
})

describe('formUrl', () => {
  const params = (url: string) => Object.fromEntries(new URL(url).searchParams)

  it('is the bare page with no values', () => {
    expect(formUrl(GET_HELP, {})).toBe(GET_HELP.url)
    expect(formUrl(GET_HELP, { cf_subject: '' })).toBe(GET_HELP.url)
  })

  it('carries the filled fields as parameters, encoded', () => {
    const url = formUrl(GET_HELP, { cf_subject: 'Login loops & fails', ticket_type: 'Login Issue' })
    expect(url.startsWith(`${GET_HELP.url}?`)).toBe(true)
    expect(params(url)).toEqual({ cf_subject: 'Login loops & fails', ticket_type: 'Login Issue' })
  })

  it('never carries consent, or a hidden section, or unknown names', () => {
    const url = formUrl(GET_HELP, {
      consent: 'yes',
      ticket_type: 'Login Issue',
      cf_journal_name: 'left over from Publishing Research',
      made_up: 'x',
    })
    expect(params(url)).toEqual({ ticket_type: 'Login Issue' })
  })

  it("carries a section's fields while its type is chosen", () => {
    const url = formUrl(GET_HELP, { ticket_type: 'Publishing Research', cf_journal_name: 'Circulation' })
    expect(params(url)).toEqual({ ticket_type: 'Publishing Research', cf_journal_name: 'Circulation' })
  })
})
