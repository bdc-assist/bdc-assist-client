import type { Sources } from '@/lib/bdc-adapter'

// BDC site forms the client can prefill (bdc-assist#64). Stand-in for the form definitions the issue proposes for
// bdc-llm's frontmatter: the Get Help form as the live page builds it (its Freshdesk field list, 2026-11-03).
// The page prefills from URL parameters named after its inputs: works on staging for every field (2026-11-20)
// except the publication date, which rejected both 2027-03-01 and 03/01/2027 (asked the web team; sent as
// YYYY-MM-DD meanwhile). Production doesn't read them yet; VITE_FORMS_SITE points Open form elsewhere.

export type FormField = {
  name: string // the form's input name
  label: string
  required?: boolean
  choices?: string[] // a dropdown
  when?: string // shown only when Type of assistance is this
  personal?: boolean // name, email: never asked for, filled only if the user offers them
  confirm?: boolean // the user does it on the form (consent): never prefilled
}

export type FormDef = { id: string; title: string; url: string; fields: FormField[] }

export const GET_HELP: FormDef = {
  id: 'get-help',
  title: 'Get Help form',
  url: 'https://biodatacatalyst.nhlbi.nih.gov/help/get-help/',
  fields: [
    { name: 'cf_requestors_name', label: 'Full name', required: true, personal: true },
    { name: 'requester', label: 'Email', required: true, personal: true },
    { name: 'cf_subject', label: 'Subject', required: true },
    {
      name: 'ticket_type',
      label: 'Type of assistance',
      required: true,
      choices: [
        'Exploring/Accessing BDC-hosted Data',
        'Publishing Research',
        'Bringing Your Own Data (BYOD)',
        'Analyzing Data/Using a BDC Workspace',
        'Sharing Data/Data Submission',
        'Usage Costs/Cloud Credits',
        'Interest in Collaborating with BDC',
        'Privacy Policy/Terms of Use',
        'Login Issue',
        'Website Issue',
        'Provide Feedback',
        'Other',
      ],
    },
    {
      name: 'cf_paper_title_or_working_title',
      label: 'Paper title (or working title)',
      required: true,
      when: 'Publishing Research',
    },
    {
      name: 'cf_expected_date_of_publication_if_known', // YYYY-MM-DD for now: the page's format is still unknown
      label: 'Expected date of publication',
      when: 'Publishing Research',
    },
    { name: 'cf_journal_name', label: 'Journal name', when: 'Publishing Research' },
    { name: 'cf_link_to_the_manuscript_if_available', label: 'Link to the manuscript', when: 'Publishing Research' },
    { name: 'cf_submitted_description', label: 'Description', required: true },
    {
      name: 'cf_research_community',
      label: 'Research community',
      choices: [
        'Bench to Bassinet',
        'BioLINCC',
        'C4R',
        'CONNECTS',
        'Cure Sickle Cell Initiative',
        'HeartShare',
        'LungMAP',
        'NSRR',
        'Pediatric Heart Network',
        'PETAL Network',
        'RECOVER',
        'RMIP',
        'TOPMed',
        'Other',
      ],
    },
    { name: 'cf_other_research_community', label: 'Research community, if not listed' },
    { name: 'consent', label: 'Consent', required: true, confirm: true },
  ],
}

export const FORMS: FormDef[] = [GET_HELP]

export const formById = (id: string) => FORMS.find((f) => f.id === id) ?? null

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '')

/** The form an answer's sources cite, if any: the answer offers to fill it in. */
export function formForSources(sources: Sources | null): FormDef | null {
  const links = Object.values(sources ?? {}).flatMap((group) => group.map((s) => s.link))
  return FORMS.find((f) => links.some((l) => sameUrl(l, f.url))) ?? null
}

export type FormValues = Record<string, string>

/** The fields the form shows for these values (a type's own section only when it's chosen). */
export const shownFields = (form: FormDef, values: FormValues) =>
  form.fields.filter((f) => !f.when || values.ticket_type === f.when)

// The site Open form goes to, e.g. https://staging.biodatacatalyst.nhlbi.nih.gov; unset = the form's own site.
// Only the link: an answer's sources still cite the production page.
const FORMS_SITE: string | undefined = import.meta.env.VITE_FORMS_SITE

/** The form's page on `site` (scheme and host; default the form's own) with the values as URL parameters;
 * blank fields and confirmations left out. */
export function formUrl(form: FormDef, values: FormValues, site = FORMS_SITE): string {
  const url = new URL(form.url)
  if (site) {
    const to = new URL(site)
    url.protocol = to.protocol
    url.host = to.host
  }
  for (const f of shownFields(form, values)) if (!f.confirm && values[f.name]) url.searchParams.set(f.name, values[f.name])
  return url.toString()
}
