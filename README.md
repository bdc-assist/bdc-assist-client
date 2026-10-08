# bdc-assist-client

A web chat client for [BDC Assist](https://github.com/bdc-assist/bdc-assist): a React app
(Vite + [assistant-ui](https://www.assistant-ui.com)) for the server's `POST /chat/stream`. It
streams answers with progress updates, shows sources, follow-up suggestions and guardrail notes,
keeps the conversation across reloads, and draws the knowledge graphs that come with an answer
(graph, flow and list views).

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
`nosources`, `crash` (the stream ends with an error), `kg` or `kg2` (a real Dug graph for one
concept, or for asthma and COPD), `related` (asthma's graph plus its related concepts); anything
else gets a docs answer with a small graph.

## Knowledge graph code

The drawing code in `src/kg/` has no framework or app dependencies, so another system can embed
it: see [src/kg/README.md](src/kg/README.md). `src/components/bdc/knowledge-graph.tsx` is this
app's React wrapper around it.

### Test fixtures

`src/kg/fixtures/`:
- `*-kg.json`: what the API sends today, made by bdc-assist's Dug interceptor (`to_kg` in
  `examples/bdc/interceptors.py`) from the real Dug results in bdc-assist's `tests/fixtures/`.
  To regenerate after a format change, run in a bdc-assist checkout and copy the output here:
  ```bash
  uv run python -c "
  import json, importlib.util as u
  s = u.spec_from_file_location('i', 'examples/bdc/interceptors.py'); m = u.module_from_spec(s); s.loader.exec_module(m)
  r = json.load(open('tests/fixtures/dug_concept_graph_chd.json'))
  a = {'concept_id': 'MONDO:0005453', 'expand_depth': 2, 'limit': 50}
  print(json.dumps([{'tool': 'get_concept_graph', 'args': a, **m.to_kg('get_concept_graph', r)}], indent=1))" > chd-kg.json
  ```
  (the same for `dug_concept_graph_asthma_copd.json`, one entry per call, and
  `dug_concept_connections_asthma.json` with `get_concept_connections`).
- `*-graph.json`: the same graphs in the client's merged form, frozen; tests check that
  `fromKgList` turns the `*-kg.json` files into these.
- `dug_curie_prefixes.json`: every CURIE prefix Dug can return, from the Dug team.

## History

This client was developed in bdc-assist's `web/` folder and moved here with its history
(`git subtree split`), so older commit messages mention `web/` paths.
