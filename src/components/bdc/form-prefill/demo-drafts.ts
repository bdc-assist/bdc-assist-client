import type { FormValues } from '@/lib/forms'

// ?tools=demo only: a stand-in for the agent that would draft the form from the conversation. Canned, for the
// stub's get_help answer (an eRA Commons login loop), as in design/form-prefill.html.

/** The first draft, and what the agent says about it. */
export async function demoFirstDraft(): Promise<{ values: FormValues; reply: string }> {
  await new Promise((r) => setTimeout(r, 1500)) // as if the agent were drafting
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

/** The draft after a chat message, and the reply. Not yet: step 6 of the tool view plan. */
export async function demoRevise(_text: string, values: FormValues): Promise<{ values: FormValues; reply: string }> {
  await new Promise((r) => setTimeout(r, 900))
  return { values, reply: "This demo can't change the draft from chat yet: click a value to edit it." }
}
