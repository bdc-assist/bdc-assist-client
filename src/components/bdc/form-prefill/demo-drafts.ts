import type { FormValues } from '@/lib/forms'

// ?tools=demo only: a stand-in for the agent that would draft the form from the conversation. Canned, for the
// stub's get_help answer (an eRA Commons login loop), as in design/form-prefill.html.

/** The first draft, and what the agent says about it. `blank`: nothing to draft from (the header's Get help in an
 * empty conversation). Otherwise always the login-loop draft, whatever the conversation was about. */
export async function demoFirstDraft(blank = false): Promise<{ values: FormValues; reply: string }> {
  await new Promise((r) => setTimeout(r, blank ? 300 : 1500)) // as if the agent were drafting
  if (blank)
    return {
      values: {},
      reply:
        'What do you need help with? Tell me here and I\'ll fill in the form, or click a value to fill it in yourself.',
    }
  return {
    values: {
      cf_subject: 'eRA Commons login loops back to the login page',
      ticket_type: 'Login Issue',
      cf_submitted_description:
        'When I log in to BDC through eRA Commons, I am sent back to the login page instead of being signed in.',
    },
    reply:
      "Here's a draft. I left your name and email for you to add on the form, or tell me them here. " +
      'The form asks for the platform you were using: which one was it?',
  }
}

const SHORT_START = 'eRA Commons login on'

/** The design page's scripted messages, offered one at a time as a suggestion: give the platform, then
 * shorten. None once both are done. */
export function demoFormSuggestion(values: FormValues): string | null {
  const description = values.cf_submitted_description ?? ''
  if (!description) return null // a blank draft: the script is for the login loop
  if (!find(PLATFORMS, description)) return "It's Terra, in Firefox. I already tried clearing cookies. Leave my name and email off."
  if (!description.startsWith(SHORT_START)) return 'Make the description shorter.'
  return null
}

// what the demo picks out of the conversation so far (the draft's description) and the new message
const PLATFORMS = ['Terra', 'Seven Bridges', 'PIC-SURE', 'Dockstore', 'Gen3']
const BROWSERS = ['Firefox', 'Chrome', 'Safari', 'Edge']
const COMMUNITIES = ['BioLINCC', 'C4R', 'CONNECTS', 'HeartShare', 'LungMAP', 'NSRR', 'RECOVER', 'RMIP', 'TOPMed']
const find = (list: string[], text: string) => list.find((x) => new RegExp(`\\b${x}\\b`, 'i').test(text))

function describe(platform: string | undefined, browser: string | undefined, cookies: boolean, short: boolean) {
  if (short)
    return `${SHORT_START} ${platform ?? 'BDC'}${browser ? ` (${browser})` : ''} loops back to the login page.` +
      (cookies ? ' Clearing cookies did not help.' : '')
  return `When I log in to ${platform ?? 'BDC'} through eRA Commons${browser ? ` in ${browser}` : ''}, I am sent ` +
    'back to the login page instead of being signed in.' + (cookies ? ' Clearing cookies did not help.' : '')
}

/** The draft after a chat message, and the reply. Understands: the platform, browser and "tried clearing
 * cookies" (rewrites the description), "shorter" (shortens it), an email address and "my name is …" (fills
 * them in), a research community. Keeps everything else, including the user's own edits. */
export async function demoRevise(
  text: string,
  values: FormValues,
  edited: string[], // fields the user changed by hand
): Promise<{ values: FormValues; reply: string }> {
  await new Promise((r) => setTimeout(r, 900)) // as if the agent were working
  const next = { ...values }
  const done: string[] = []
  const known = `${values.cf_submitted_description ?? ''} ${text}`
  const platform = find(PLATFORMS, known)
  const browser = find(BROWSERS, known)
  const cookies = /cookies/i.test(known)
  const short = /\bshort(er|en)?\b/i.test(text) || (values.cf_submitted_description ?? '').startsWith(SHORT_START)
  if (find(PLATFORMS, text) || find(BROWSERS, text) || /cookies/i.test(text) || /\bshort(er|en)?\b/i.test(text)) {
    next.cf_submitted_description = describe(platform, browser, cookies, short)
    done.push(/\bshort(er|en)?\b/i.test(text) ? 'Shortened the description.' : 'Updated the description.')
  }
  const email = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0]
  if (email) {
    next.requester = email
    done.push('Added your email.')
  }
  const name = text.match(/\b[Mm]y name is ([A-Z][\w'-]*(?: [A-Z][\w'-]*)*)/)?.[1]
  if (name) {
    next.cf_requestors_name = name
    done.push('Added your name.')
  }
  const community = find(COMMUNITIES, text)
  if (community) {
    next.cf_research_community = community
    done.push(`Set the research community to ${community}.`)
  }
  if (!done.length)
    return {
      values,
      reply:
        'This demo understands the platform and browser, "I tried clearing cookies", "make it shorter", ' +
        'your name ("my name is …") and email, and a research community. Or click a value to edit it.',
    }
  if (/leave (my )?name|leave .*email|no name/i.test(text) && !name && !email) done.push('Name and email stay blank.')
  if (edited.includes('cf_subject')) done.push('I kept your subject.')
  return { values: next, reply: done.join(' ') }
}
