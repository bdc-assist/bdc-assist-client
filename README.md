# bdc-assist-client

A web chat client for [BDC Assist](https://github.com/bdc-assist/bdc-assist): a React app
(Vite + [assistant-ui](https://www.assistant-ui.com)) for the server's `POST /chat/stream`. It
streams answers with progress updates, shows sources, follow-up suggestions and guardrail notes,
keeps conversations in the browser (listed in a sidebar), and draws the knowledge graphs that come
with an answer (graph, flow and list views).

The API it talks to is documented in bdc-assist's README (section *API*); that's the reference
for the stream events and the `kg`, `sources` and `blocked` fields.

## Run

Needs Node 20+ and a running bdc-assist server.

```bash
npm install                                       # once
npm run dev                                       # http://localhost:5173, API on :8010, bdc-side-panel on :8012
VITE_API_URL=http://127.0.0.1:8011 VITE_SIDE_PANEL_URL=http://127.0.0.1:8013 npm run dev   # against the stubs instead
VITE_SIDE_PANEL_URL= npm run dev                  # no form prefill (bdc-side-panel, below)
# Open on BDC links the live site; VITE_FORMS_SITE_URL=https://staging.biodatacatalyst.nhlbi.nih.gov links staging
npm test                                          # unit tests, no server needed
npm run build                                     # production build in dist/
```

Add `?reveal=after-check` to the page URL (or set `VITE_REVEAL=after-check`) to hold each answer
back behind placeholder bars until the output guardrail has passed it, instead of streaming it.

### Without real services

bdc-assist has a stub server that serves its real API with a scripted agent. From a bdc-assist
checkout: `uv run python tests/_stub_stream_server.py` (port 8011), then run this client with
`VITE_API_URL=http://127.0.0.1:8011`. A keyword in the question picks a path: `block` (input
guardrail refuses), `reject` (output guardrail replaces the draft), `canned` (predefined reply),
`nosources`, `crash` (the stream ends with an error), `get_help` (an answer citing the Get Help
page, offering its form). A Dug tool's name picks its real graph:
`concept_graph` (congenital heart disease), `concept_graph_2` (asthma and COPD), `concept_connections`
(asthma's related concepts), `cohort_variables` (asthma + COPD search words), `search_concepts` (a BMI
search); several combine, e.g. `concept_graph_2 concept_connections`. Anything else gets a docs answer
with a small graph.

bdc-side-panel has one too: from its checkout, `uv run python tests/_stub_server.py` (port 8013), then
`VITE_SIDE_PANEL_URL=http://127.0.0.1:8013`. It serves the real forms from a fixture and drafts them with a
scripted LLM; `block` and `reject` in a panel message show the blocked and rejected replies. With both stubs,
`get_help` gives a form card that drafts.

### Tool view

The tool view (bdc-assist#64): an object from an answer (a graph, a form draft) opens in a side panel beside the conversation, with its own chat that changes it in
place; the answer keeps a small card for it. Drag the divider to resize (remembered per tool in
this browser); on a narrow window the panel is full screen. Forms: see Form prefill below. The graph's
panel is still a mock-up faked in the client:

- **Knowledge graph**: ask the stub `concept_graph_2` and open the graph's side panel. The panel's
  chat understands one request, expanding asthma, which merges in the `concept_connections` graph.
  Undo and Redo step through changes; *Edited* has *Reset to original*.

Graph edits are canned (`src/components/bdc/knowledge-graph/demo-edits.ts`), so they work against the stub
only, and are kept in memory, not saved with the conversation. Code: `src/components/bdc/tool-view/` (the panel,
card and chat every tool shares).

## Form prefill

With bdc-side-panel running (its own service: drafts the BDC site's forms; `VITE_SIDE_PANEL_URL`, default
`http://127.0.0.1:8012`, empty for none), an answer the
server offers a form under gets the form's card (bdc-assist's BDC config, `form_offer` in the `done` event:
`{question, forms: [{id, title, url}]}`). Opening it drafts the form in the side panel, from the conversation up
to that answer and its question. Refine the draft by its chat or by clicking a value; *Open on BDC* goes to the
form's page on the BDC site (another site by `VITE_FORMS_SITE_URL`, e.g. staging) with the values as URL
parameters, where the user checks
and submits. The header's **Get help** button has a Get Help draft of its own, drafted from the whole
conversation (blank in a new one).

- The form definitions come from bdc-side-panel's `GET /tools`, loaded once at startup (`src/lib/side-panel.ts`,
  `src/lib/forms.ts`). If it's down then, there are no form cards and no Get help button.
- The panel chat is its own conversation: its first draft gets the main chat up to the answer, later turns a
  summary of it (from the first draft) and the question, never the main chat itself.
- **Personal fields** (name, email) are filled in by hand only: their values never leave the browser except in the
  Open on BDC link, and the drafter never fills them. Fields the user completes on the real form (consent) aren't
  in the definitions at all.
- Drafts are kept in memory, not saved with the conversation; the cards are (they're message parts).
- Busy or failing, bdc-side-panel says so in the panel chat; the fields still work by hand.

Code: `src/components/bdc/form-prefill/` (`use-form-draft.ts`: a draft and its turns; `draft-tool.tsx`: the draft
in the tool view).

## Saved conversations

Conversations are kept in the browser's localStorage only (keys `bdc-assist:*`), through
assistant-ui's localStorage thread-list adapter: `bdc-assist:threads` lists them and
`bdc-assist:messages:<id>` holds each one; `bdc-assist:open` is the one to reopen on load. Titles are
the first question. localStorage holds about 5 MB per site; when a save fails because it's full, a
dialog lists the conversations to delete and saves the answer once there's room
(`src/lib/conversation-storage.ts`, `src/components/bdc/storage-full-dialog.tsx`).

## assistant-ui components

`src/components/assistant-ui/elements/` holds assistant-ui's registry components, added with
`npx shadcn add @assistant-ui/<name>`. A few carry local edits, marked `bdc-assist local edit`:
redo them after re-pulling a component (`thread.aui.tsx`, `thread-list.aui.tsx`,
`threadlist-sidebar.aui.tsx`). Of the shadcn components in `src/components/ui/`, `sonner.tsx`
(toasts) has one too: it follows our `dark` class instead of `next-themes`.

## Knowledge graph code

The drawing code in `src/kg/` has no framework or app dependencies, so another system can embed
it: see [src/kg/README.md](src/kg/README.md). `src/components/bdc/knowledge-graph/` is this
app's React wrapper around it.

### Test fixtures

`src/kg/fixtures/`:
- `kg/<keyword>.json`: what the `done` event carries (`{kg, sources}`) for each of the stub's
  Dug keywords, generated by bdc-assist (`tests/make_kg_fixtures.py`) from real Dug results.
- `graph/<keyword>.json`: `fromKgList` of each, the client's merged graph; tests check that
  `fromKgList` still makes it.
- `dug_curie_prefixes.json`: every CURIE prefix Dug can return, from the Dug team.

After bdc-assist's fixtures change, or after changing `fromKgList`, run `npm run fixtures` (it reads
`../bdc-assist`, or `BDC_ASSIST=<path>`) and review the diff.

## History

This client was developed in bdc-assist's `web/` folder and moved here with its history
(`git subtree split`), so older commit messages mention `web/` paths.
