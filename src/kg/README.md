# `src/kg`: knowledge graph views

Draws the knowledge graph BDC Assist returns with its answers: the Dug concepts an
answer is about, the study variables linked to them, and the studies those variables
belong to. Two views (a node-link graph and a Sankey "flow") plus plain helpers for
building your own UI (lists, tables, links).

It is self-contained so it can be lifted into another system:

- no framework: plain TypeScript and the DOM; React, Vue, Angular or plain HTML all
  call it the same way
- no imports from the rest of this app
- dependencies: [`cytoscape`](https://js.cytoscape.org) with `cytoscape-fcose` (graph
  view) and [`d3-sankey`](https://github.com/d3/d3-sankey) (flow view)
- styling through CSS custom properties, so the host restyles it from its own CSS

The demo client's wrapper, [`components/bdc/knowledge-graph.tsx`](../components/bdc/knowledge-graph.tsx),
is a working example of everything below (React, but only as glue).

## The data

The API sends the agent's knowledge graphs as `kg`: in the `sources` event of
`POST /chat/stream` (as soon as the agent is done), in its `done` event, and in
`POST /chat`. It's a list, one graph per tool call, attached by the Dug interceptor
(`examples/bdc/interceptors.py` in [bdc-assist](https://github.com/bdc-assist/bdc-assist)):

```ts
type KgWireEntry = {
  tool: string; args?: object; label?: string
  seeds?: string[]  // ids of the nodes the call asked about (none for searches)
  nodes: { id: string; name?: string; type?: string; category?: string;
           description?: string; attributes?: { related_concepts_count?: number } }[]
  edges: { subject: string; object: string; predicate?: string }[]
}
```

`fromKgList(kg)` (`wire.ts`) merges them into the one graph the views draw, or `null`
when there's nothing to draw. A node's role comes from `type` if it names one, else
from `category` (`"Study"`, `"StudyVariable"`; anything else is a concept). Edges keep
all their predicates, also through `collapseVersions`:

```ts
type KgGraph = { nodes: KgNode[]; edges: KgEdge[] }

type KgNode = {
  id: string                       // concept CURIE, search word, dbGaP variable or study accession (with version)
  label: string
  type: 'concept' | 'term' | 'variable' | 'study'  // term: a search word standing in for a concept
                                                   // (find_cohort_variables): no link, no category
  concept_type?: string            // concepts: Dug's biolink category, verbatim
  seed?: true                      // a call asked about it (any call's `seeds`): what the user asked about
  description?: string             // Dug's, verbatim (search_concepts variables have one)
  related_concepts_count?: number  // variables: how many other concepts it links to
  grouped?: KgNode[]               // after groupSynonyms: the concepts merged into this node
  versions?: string[]              // after collapseVersions: the versioned ids merged into this node
}

type KgEdge = { source: string; target: string; predicates?: string[] }
// variable → concept, variable → study; concept → concept with Dug's predicates (a pair
// can be related more than one way, e.g. "ameliorates condition" and "applied to treat")
```

## Quick start

```ts
import { mountGraph } from './kg/mount'
import { fromKgList } from './kg/wire'

const graph = fromKgList(doneEvent.kg)
if (graph) {
  const view = mountGraph(document.querySelector('#kg')!, graph, {
    layout: 'radial',
    onFocus: (focus) => showDetails(focus),  // your UI
  })
  // later: view.update(otherGraph), view.destroy()
}
```

The container needs a size (e.g. `height: 18rem`). Swap `mountGraph` for `mountFlow`
to get the Sankey view; both have the same interface.

## Views

Both views take the same options and return the same interface (`view.ts`), so a host
can switch between them without caring which one is showing.

```ts
type KgViewOptions = {
  collapseVersions?: boolean  // merge a study's or variable's dbGaP releases into one node (default true)
  groupSynonyms?: boolean     // merge concepts with exactly the same neighbours, e.g. synonyms (default true)
  sharedOnly?: boolean        // only studies with variables on two or more seeds (default false)
  onFocus?: (focus: KgFocus | null) => void  // the user picked something; null: clicked the background
}

type KgView = {
  update(graph, options?)  // draw another graph, or the same with other options
  setOptions(options)      // change options for the current graph
  focus(focus | null)      // show a focus picked elsewhere (another view, your list); doesn't call onFocus
  resize()                 // after the container changed size, e.g. was hidden and shown
  refreshStyle()           // re-read the --kg-* colours, e.g. after a theme change
  destroy()
}
```

**Focus.** What the user picked, the same in every view:

```ts
type KgFocus = { node: string } | { concept: string; study: string }
```

A node (concept, study or variable), or a concept × study pair: "what does this study
have on this concept?" (a band in the flow view). The view highlights what it connects
(see `focusConnections`) and fades the rest. To keep several views and your own UI in
step, keep one focus in the host: on any view's `onFocus`, store it and call `focus()`
on the others. A redraw (`setOptions` with other grouping or `sharedOnly`) keeps the
focus where it can: on what it was merged into, or split into (`carryFocus`). When that
moves or drops it, the view calls `onFocus`. `update()` with another graph clears it.

### `mountGraph(container, graph, options)` (`mount.ts`)

A node-link graph (Cytoscape). Concepts, variables and studies are drawn as distinct
shapes and colours; variables run from `--kg-variable-low` to `--kg-variable-high` with
`related_concepts_count`; search terms are tinted with an outline; concept → concept
links are a light tint of the concept colour; the focused node gets an outline ring.
Seeds (what was asked about), of any type, get a wide `--kg-halo` halo and a label
highlighted in the same colour; studies (or variables) connecting two or more seeds
(shared) get a narrow one.

Extra options:

| Option | |
|---|---|
| `layout` | `'radial'` (default: the seeds in the middle, or the concepts when there are none; variables around, studies outside; separate pieces side by side, each round its own centre), `'force'` (force-directed, turned wide). Both listed in `KG_LAYOUTS` |
| `variables` | `false` (default): one link per concept and study, as wide as its variables (√count), flat mid-blue; variables without a study link to a grey "No study provided" placeholder. Clicking a link focuses its concept × study pair. Without any studies, every link goes to the placeholder. `true`: each variable |
| `zoomGestures` | `false` (default: the wheel scrolls the page), `'modifier'` (Ctrl/⌘ + wheel zooms; trackpad pinch counts), `true` (the wheel always zooms). Use `'modifier'` where a page scrolls around the graph |
| `onZoomHint` | `'modifier'` mode: called when the wheel turns over the graph without Ctrl/⌘, so you can say how to zoom |
| `forcePositions` | a `Map` where Force keeps its node positions. Give two views of the same graph (inline and maximized) the same empty `Map`, and the second shows the first's layout, drags included. It's for one graph: give `update()` a new `Map` with a new graph |

Extra methods: `zoomBy(factor)` and `fit()`, for your own zoom buttons, and
`restorePositions()`, to show what another view sharing `forcePositions` moved. Hovering a
node shows its full label as the browser's tooltip.

### `mountFlow(container, graph, options)` (`flow.ts`)

A Sankey diagram (d3-sankey layout, plain SVG): concepts on the left, studies on the
right, each concept → study band as wide as the study's variables on that concept.
As in the graph view, seeds get a wide halo round their bar and a highlighted label,
shared studies a narrow halo, search terms a tinted bar, and the focus a ring. Variables
whose study isn't provided flow to a "No study provided" placeholder, outlined in grey, last
(only when there are real studies too). Clicking a band focuses its concept × study pair. Variables aren't drawn, but a
variable focus highlights its band. It lays out for the container's size, so call
`resize()` (or use a `ResizeObserver`) when that changes.

## Colours

Set these on the container or any ancestor; any CSS colour works (including
`oklch()` and `var()`). Unset ones use the defaults.

| Property | Default | Used for |
|---|---|---|
| `--kg-concept` | `#d97706` | concepts; mixed into the background for search terms' fill and concept → concept links |
| `--kg-variable-low` | `#93c5fd` | variables with the fewest related concepts |
| `--kg-variable-high` | `#1e40af` | variables with the most; flow bands are a mix of the two. Swap the two on dark backgrounds, so more always means more contrast |
| `--kg-study` | `#059669` | studies |
| `--kg-edge` | `#cbd5e1` | graph edges |
| `--kg-label` | `#475569` | labels |
| `--kg-selected` | `#0f172a` | the outline ring around the focused node |
| `--kg-halo` | `#fde047` | the halo of seeds (wide) and shared nodes (narrow), and seeds' highlighted labels (graph view) |
| `--kg-halo-opacity` | `0.45` | a number, not a colour: the opacity of the halos and the seeds' label highlight, whose text turns black or white to read on it. Lower it on dark backgrounds |

## Helpers for your own UI

All plain functions of a `KgGraph`. Apply `collapseVersions`, `groupSynonyms` (and `sharedOnly`, if
used) first, so ids match what the views draw.

| Function | File | |
|---|---|---|
| `collapseVersions(graph)`, `baseId(id)` | `collapse.ts` | merge dbGaP releases (`phs000007.v34.p15` + `.v31.p12` → `phs000007`, with `versions`) |
| `groupSynonyms(graph)` | `group.ts` | merge concepts with exactly the same neighbours (some variables), e.g. a search's synonyms, into "first + N more" (with `grouped`); never seeds or terms |
| `bridges(graph)`, `sharedOnly(graph)` | `bridges.ts` | the nodes connecting two or more seeds (other concepts, e.g. synonyms, don't count); the graph reduced to them |
| `studyList(graph)` | `list.ts` | studies → concepts → variables, shared studies first: for a list or table view, or a text alternative to the graph |
| `nodeLinks(node, graph)`, `conceptLink(id)` | `links.ts` | pages for a node: dbGaP study and variable pages (one per release; a variable without an accession gets its study, with a `note`); concepts by CURIE prefix (MONDO, EFO, UMLS, GTOPDB, otherwise bioregistry.io), marked "(login)" where an account is needed |
| `focusConnections(graph, focus)`, `pairVariables(graph, concept, study)`, `studylessVariables(graph)` | `focus.ts` | what a focus lights up; a pair's variables; the variables whose study isn't provided |
| `NO_STUDY`, `NO_STUDY_LABEL` | `types.ts` | the "No study provided" placeholder for variables whose study isn't provided: never a node in the graph, but views draw it and it focuses like a study (`{ node: NO_STUDY }`, `{ concept, study: NO_STUDY }`) |
| `graphShape(graph)` | `shape.ts` | which views suit the graph (`available`: `true` or why not, for each of `KG_VIEWS`) and the `default` (Force); work it out before `sharedOnly`. `shapeOf(graph)` gives the shape it's based on: seeds, variables, studies, inter-concept links |
| `bundles(graph)` | `bundle.ts` | one `{ concept, study, variables }` per concept and study (the study can be `NO_STUDY`): what Flow's bands and node-link's links draw |
| `flowData(graph)` | `flow.ts` | the flow's concept → study links with their variables, for your own chart; variables without a study go to the placeholder (`placeholder: true`, last), but only alongside real studies; `withoutStudy` lists them |
| `fromKgList(kg)` | `wire.ts` | the API's per-call graphs merged into one |
| `relations(graph)` | `elements.ts` | the concept → concept edges (drawn as light amber lines in the graph view; the flow view can't show them) |
| `variableWeights(graph)` | `elements.ts` | `related_concepts_count` scaled to 0..1 within the graph |
| `isConceptOrTerm(type)` | `types.ts` | concepts and search terms play the same part (what variables are about); most views treat them alike, but a term has no link or category |

## Things to know

- **Give the container a size, and don't position it with `position: absolute`.**
  Cytoscape adds `position: relative` to its container from an unlayered style sheet,
  which wins over layered CSS such as Tailwind's utilities. Size it with a height
  inside a positioned wrapper instead.
- **Hidden containers:** a view mounted in a hidden container lays out for a fallback
  size; call `resize()` once it's shown.
- **Variable IDs that aren't `phv` accessions** (e.g. `phs003708_MHASTH.v1.p1`, study +
  variable name): dbGaP lists only a few variables for some studies, so Dug takes their
  data dictionary from PIC-SURE, and there's no dbGaP variable page. `nodeLinks` gives
  their study's page instead, with `note: NO_VARIABLE_ACCESSION` ("No dbGaP variable
  accession available") so you can say why.
- **The force layout is stable:** the same graph always gets the same layout (it
  starts from the radial one, with a fixed seed, and is turned wide). Where every node
  already has a place, nothing moves: dragged nodes stay, and `sharedOnly` turned on
  only hides some. A redraw that brings in new nodes lays out afresh. Give a second
  view (e.g. maximized) the same `forcePositions` to show the first one's drags too.
