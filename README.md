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
npm run dev                                       # http://localhost:5173, API on :8010
VITE_API_URL=http://127.0.0.1:8011 npm run dev    # against bdc-assist's stub server instead
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
page, for the form demo below). A Dug tool's name picks its real graph:
`concept_graph` (congenital heart disease), `concept_graph_2` (asthma and COPD), `concept_connections`
(asthma's related concepts), `cohort_variables` (asthma + COPD search words), `search_concepts` (a BMI
search); several combine, e.g. `concept_graph_2 concept_connections`. Anything else gets a docs answer
with a small graph.

### Tool view

The tool view is a mock-up for bdc-assist#64 faked in the client (no API changes). An object from
an answer opens in a side panel beside the conversation, with its own chat that changes it in
place; the answer keeps a small card for it. Drag the divider to resize (remembered per tool in
this browser); on a narrow window the panel is full screen.

- **Knowledge graph**: ask the stub `concept_graph_2` and open the graph's side panel. The panel's
  chat understands one request, expanding asthma, which merges in the `concept_connections` graph.
  Undo and Redo step through changes; *Edited* has *Reset to original*.
- **Get Help form**: ask the stub `get_help`. The answer offers to fill in the BDC Get Help form;
  opening it drafts the form in the side panel. Refine it by its chat (suggestion buttons give the
  scripted messages) or by clicking a value, then *Open form* goes to the BDC page with the values
  as URL parameters (whether the site will read them isn't decided yet).
- **Get help button** in the header: its own Get Help draft, separate from any answer's, drafted
  from the conversation (blank in a new one).

Drafting and the chats are canned (`src/components/bdc/knowledge-graph/demo-edits.ts`,
`src/components/bdc/form-prefill/demo-drafts.ts`), so they work against the stub only, and edits
are kept in memory, not saved with the conversation. The form's fields are a local stand-in
(`src/lib/forms.ts`) for definitions the BDC docs would provide. Code: `src/components/bdc/tool-view/`
(the panel, card and chat every tool shares) and `src/components/bdc/form-prefill/`.

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
