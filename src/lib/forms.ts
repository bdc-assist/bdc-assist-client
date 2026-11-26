import { useSyncExternalStore } from 'react'

// BDC site forms the side panel can prefill (bdc-assist#64): their definitions come from bdc-side-panel's
// GET /tools (lib/side-panel.ts loads them at startup), built from bdc-llm's form blocks. Fields the user
// completes on the real form (consent) aren't in them; personal ones (name, email) are filled in by hand only.

export type FieldKind = 'text' | 'paragraph' | 'date' | 'number' | 'checkbox' | 'dropdown'

export type FormField = {
  name: string // the form's input name, and its URL parameter
  label: string
  kind: FieldKind
  required: boolean
  choices?: string[] // a dropdown's
  when?: Record<string, string[]> // shown only while each named field has one of these values
  personal?: boolean // filled in by hand only: never sent to bdc-side-panel, never drafted
}

export type FormDef = { id: string; title: string; url: string; fields: FormField[] }

export type FormValues = Record<string, string>

// the forms bdc-side-panel lists; none until they load, or if it's down
let forms: FormDef[] = []
const listeners = new Set<() => void>()

export function setForms(next: FormDef[]) {
  forms = next
  listeners.forEach((l) => l())
}

export const currentForms = () => forms

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useForms = () => useSyncExternalStore(subscribe, currentForms)

export function useForm(id: string): FormDef | null {
  return useForms().find((f) => f.id === id) ?? null
}

/** The fields the form shows for these values (a section's only while its choice is picked). */
export const shownFields = (form: FormDef, values: FormValues) =>
  form.fields.filter((f) => Object.entries(f.when ?? {}).every(([k, choices]) => choices.includes(values[k] ?? '')))

/** The form's page with the values as URL parameters; blank and hidden fields left out. The live site's page (the
 * form's own url), or the same page on another site by VITE_FORMS_SITE_URL, e.g. staging's to try a site change.
 * An anchor in the url (the form's place on a long page) stays last, after the parameters. */
export function formUrl(form: FormDef, values: FormValues): string {
  const site: string = import.meta.env.VITE_FORMS_SITE_URL ?? '' // read here, so tests can stub it
  const url = new URL(form.url)
  if (site) {
    // the same page on that site, named as its links are: no trailing slash
    const other = new URL(site)
    url.protocol = other.protocol
    url.host = other.host
    url.pathname = other.pathname.replace(/\/$/, '') + url.pathname.replace(/\/$/, '')
  }
  for (const f of shownFields(form, values)) if (values[f.name]) url.searchParams.set(f.name, values[f.name])
  return url.toString()
}

const isPersonal = (form: FormDef, name: string) => form.fields.some((f) => f.name === name && f.personal)

/** The values without personal ones: what may go to bdc-side-panel. */
export const withoutPersonal = (form: FormDef, values: FormValues): FormValues =>
  Object.fromEntries(Object.entries(values).filter(([k]) => !isPersonal(form, k)))

/** bdc-side-panel's values (which never hold personal ones) plus the personal ones the user typed. */
export const mergeReply = (form: FormDef, current: FormValues, reply: FormValues): FormValues => ({
  ...withoutPersonal(form, reply),
  ...Object.fromEntries(Object.entries(current).filter(([k]) => isPersonal(form, k))),
})

/** The draft's one-line summary (its card and the tool's header): the first two filled fields, not personal ones. */
export function draftSummary(form: FormDef, values: FormValues): string | null {
  const filled = shownFields(form, values).filter((f) => !f.personal && values[f.name])
  return filled.length ? filled.slice(0, 2).map((f) => values[f.name]).join(' · ') : null
}

/** The forms the header's menu lists under "Support"; the rest go under "Other BDC forms". Not in the form data
 * (a web team question), so kept here by id: a new form bdc-side-panel lists goes under Other until it's added. */
export const HELP_FORMS = ['get-help', 'contact-bdc']

export type FormGroup = { label: string; forms: FormDef[] }

/** The header menu's groups: help forms, then the others, each in bdc-side-panel's order; an empty group left out. */
export function groupForms(forms: FormDef[]): FormGroup[] {
  const groups = [
    { label: 'Support', forms: forms.filter((f) => HELP_FORMS.includes(f.id)) },
    { label: 'Other BDC forms', forms: forms.filter((f) => !HELP_FORMS.includes(f.id)) },
  ]
  return groups.filter((g) => g.forms.length > 0)
}
