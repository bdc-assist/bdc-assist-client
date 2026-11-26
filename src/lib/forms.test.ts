import { afterEach, describe, expect, it, vi } from 'vitest'

import { draftSummary, formUrl, groupForms, mergeReply, shownFields, withoutPersonal, type FormDef } from '@/lib/forms'

// a Get Help–like definition, as bdc-side-panel's GET /tools serves it
const GH: FormDef = {
  id: 'get-help',
  title: 'Get Help',
  url: 'https://biodatacatalyst.nhlbi.nih.gov/help/get-help/',
  fields: [
    { name: 'cf_requestors_name', label: 'Full Name', kind: 'text', required: true, personal: true },
    { name: 'requester', label: 'Email', kind: 'text', required: true, personal: true },
    { name: 'cf_subject', label: 'Subject', kind: 'text', required: true },
    {
      name: 'ticket_type',
      label: 'Type',
      kind: 'dropdown',
      required: true,
      choices: ['Publishing Research', 'Login Issue', 'Other'],
    },
    {
      name: 'cf_paper_title_or_working_title',
      label: 'Paper title',
      kind: 'paragraph',
      required: true,
      when: { ticket_type: ['Publishing Research'] },
    },
    { name: 'cf_journal_name', label: 'Journal', kind: 'text', required: false, when: { ticket_type: ['Publishing Research'] } },
    { name: 'cf_submitted_description', label: 'Description', kind: 'paragraph', required: true },
  ],
}

describe('shownFields', () => {
  const names = (values: Record<string, string>) => shownFields(GH, values).map((f) => f.name)

  it("shows a section's fields only while its choice is picked", () => {
    expect(names({})).not.toContain('cf_journal_name')
    expect(names({ ticket_type: 'Login Issue' })).not.toContain('cf_journal_name')
    expect(names({ ticket_type: 'Publishing Research' })).toEqual(GH.fields.map((f) => f.name))
  })

  it('needs every condition of a field to hold', () => {
    const form: FormDef = {
      ...GH,
      fields: [{ name: 'x', label: 'X', kind: 'text', required: false, when: { a: ['1'], b: ['2'] } }],
    }
    expect(shownFields(form, { a: '1' })).toEqual([])
    expect(shownFields(form, { a: '1', b: '2' }).map((f) => f.name)).toEqual(['x'])
  })
})

describe('formUrl', () => {
  const params = (url: string) => Object.fromEntries(new URL(url).searchParams)
  // the live site: the form's own page
  const PAGE = GH.url
  afterEach(() => vi.unstubAllEnvs())

  it('is the bare page with no values', () => {
    expect(formUrl(GH, {})).toBe(PAGE)
    expect(formUrl(GH, { cf_subject: '' })).toBe(PAGE)
  })

  it('carries the filled fields as parameters, encoded', () => {
    const url = formUrl(GH, { cf_subject: 'Login loops & fails', ticket_type: 'Login Issue' })
    expect(url.startsWith(`${PAGE}?`)).toBe(true)
    expect(params(url)).toEqual({ cf_subject: 'Login loops & fails', ticket_type: 'Login Issue' })
  })

  it('never carries a hidden section or unknown names', () => {
    const url = formUrl(GH, { ticket_type: 'Login Issue', cf_journal_name: 'left over', made_up: 'x' })
    expect(params(url)).toEqual({ ticket_type: 'Login Issue' })
  })

  it('carries personal values typed by hand', () => {
    expect(params(formUrl(GH, { requester: 'a@b.org' }))).toEqual({ requester: 'a@b.org' })
  })

  it('goes to the same page on another site by VITE_FORMS_SITE_URL', () => {
    // its pages named as its links are: no trailing slash
    vi.stubEnv('VITE_FORMS_SITE_URL', 'https://staging.biodatacatalyst.nhlbi.nih.gov/')
    expect(formUrl(GH, { ticket_type: 'Login Issue' })).toBe(
      'https://staging.biodatacatalyst.nhlbi.nih.gov/help/get-help?ticket_type=Login+Issue',
    )
    vi.stubEnv('VITE_FORMS_SITE_URL', '')
    expect(formUrl(GH, {})).toBe(GH.url)
  })

  it('keeps an anchor in the url last, after the parameters', () => {
    const anchored = { ...GH, url: `${GH.url}#get-help-form` }
    const url = formUrl(anchored, { ticket_type: 'Login Issue' })
    expect(url).toBe(`${GH.url}?ticket_type=Login+Issue#get-help-form`)
    expect(formUrl(anchored, {})).toBe(anchored.url)
    vi.stubEnv('VITE_FORMS_SITE_URL', 'https://staging.biodatacatalyst.nhlbi.nih.gov')
    expect(formUrl(anchored, { ticket_type: 'Login Issue' })).toBe(
      'https://staging.biodatacatalyst.nhlbi.nih.gov/help/get-help?ticket_type=Login+Issue#get-help-form',
    )
  })
})

describe('personal fields', () => {
  it('withoutPersonal strips their values', () => {
    expect(withoutPersonal(GH, { requester: 'a@b.org', cf_requestors_name: 'Jane', cf_subject: 'S' })).toEqual({
      cf_subject: 'S',
    })
  })

  it("mergeReply keeps the user's personal values", () => {
    expect(mergeReply(GH, { requester: 'a@b.org', cf_subject: 'Old' }, { cf_subject: 'New', requester: 'x@y.org' })).toEqual(
      { requester: 'a@b.org', cf_subject: 'New' },
    )
    expect(mergeReply(GH, { cf_subject: 'Old' }, {})).toEqual({})
  })
})

describe('draftSummary', () => {
  it('shows the first two filled non-personal fields', () => {
    const values = { requester: 'a@b.org', cf_subject: 'Login loop', ticket_type: 'Login Issue', cf_submitted_description: 'D' }
    expect(draftSummary(GH, values)).toBe('Login loop · Login Issue')
    expect(draftSummary(GH, { cf_submitted_description: 'D' })).toBe('D')
    expect(draftSummary(GH, { requester: 'a@b.org' })).toBeNull()
    expect(draftSummary(GH, {})).toBeNull()
  })
})

describe('groupForms', () => {
  const form = (id: string): FormDef => ({ id, title: id, url: `https://example.org/${id}/`, fields: [] })
  const ids = (forms: FormDef[]) => groupForms(forms).map((g) => [g.label, g.forms.map((f) => f.id)])

  it('puts the help forms first, the rest after, each in the order given', () => {
    expect(ids(['costs', 'contact-bdc', 'stay-connected', 'get-help'].map(form))).toEqual([
      ['Support', ['contact-bdc', 'get-help']],
      ['Other BDC forms', ['costs', 'stay-connected']],
    ])
  })

  it('puts a form it does not know under Other', () => {
    expect(ids(['get-help', 'new-form'].map(form))).toEqual([
      ['Support', ['get-help']],
      ['Other BDC forms', ['new-form']],
    ])
  })

  it('leaves out an empty group', () => {
    expect(ids(['costs'].map(form))).toEqual([['Other BDC forms', ['costs']]])
    expect(ids([])).toEqual([])
  })
})
