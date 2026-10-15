# `src/kg` design: shapes, views, visual grammar

How the knowledge graph views should behave, as agreed so far. [README.md](README.md)
documents the API as it is; this file is the target it moves towards. Items marked
**(planned)** don't exist yet; **(open)** still needs a decision.

## 1. What the data guarantees

Four node types and three edge types, nothing else:

| Edge | Stated by |
|---|---|
| variable → concept (or term) | concept_graph, cohort_variables, search_concepts |
| variable → study | concept_graph, cohort_variables |
| concept → concept, with predicates: an **inter-concept link** | concept_connections |

So a concept reaches a study **only** through variables, and a study is never linked to
anything but variables. Views can rely on this.

**Collapsing paths.** Any path through variables can be drawn as one link between its
ends (concept–study, concept–concept): it summarises edges Dug stated, so it isn't
inference. The rules:

- it's a count, "N variables", and never carries a predicate
- it's drawn in the bundle style (§4), never like an inter-concept link
- it opens up to the variables it stands for (the focus shows them)
- counts are taken on the graph as drawn: after version merging, one per variable even
  when several calls returned it

Whether a view shows a particular collapse is a design choice, not a correctness one.
Example: concept–concept bundles are meaningless for search_concepts (every concept
shares almost every variable), which is why those concepts are grouped instead.

## 2. Shape model

A graph's shape is **what it contains**, not which tool made it:

```ts
type KgShape = {
  seeds: number               // nodes a call asked about
  variables: boolean
  studies: boolean
  interConceptLinks: boolean  // concept → concept edges, with Dug's predicates
}
```

Computed on the graph being shown (the source picked, grouped or not), **before**
"Shared only", so the filter never changes which views are offered.

| Typical shape | From | seeds | variables | studies | inter-concept links |
|---|---|---|---|---|---|
| Concept → variable → study | concept_graph | 1+ concepts | ✓ | ✓ | |
| Same, with search terms | cohort_variables | 2+ terms | ✓ | ✓ | |
| Concepts and variables | search_concepts | 0 | ✓ | | |
| Concept star | concept_connections | 1 | | | ✓ |
| Mixed | several calls in "All results" | any | any | any | any |

`graphShape(graph) → { available: Record<View, true | reason>, default: View }`
(shape.ts) turns a shape into the views on offer.

## 3. Views

| View | Needs | Shows | Leaves out |
|---|---|---|---|
| Radial | a seed | seeds in the middle, studies around them joined by bundles (with Variables on: variables in between) | — |
| Force | — | everything: concepts and studies joined by bundles, or individual variables with Variables on | — |
| Flow | studies | concept → study bands, width = variable count; variables without a study go to the placeholder | inter-concept links |
| List | — | studies → concepts → variables; no studies: grouped by concept; no variables (star): the concepts, seeds first (grouped by predicate: parked) | inter-concept links |

Matrix (studies × concepts) was built and then parked: with the data we have it added
little over Flow and List (see Parked below).

Columns (concepts | variables | studies) has been dropped (step 6). Radial and Force can show
individual variables.

**Variables without a study** go under a **"No study provided"** placeholder, placed last,
in List, Flow and collapsed node-link. The placeholder belongs to the view, not the graph:
it's never a node in `KgGraph`, so nothing is inferred. It's drawn outlined in grey,
never study green. It's left out of study counts, the title summary and "shared", so it
never gets a halo. When some variables have studies and some don't, it sits alongside
the real studies. A view that needs studies (Flow) still needs at least one real study.
List uses the same label. Say "provided", not "given": the result didn't provide the
study, which doesn't mean there isn't one. Elsewhere, "no study provided", not "without
a study".

Unavailable views stay in the picker, greyed out, with the reason as their native
tooltip (`title`; some browsers don't show it on an `<option>`): "Needs a concept that
was asked about", "Needs studies".

**Default view:** Force, for every shape. It's always available, and it's the only
node-link view that shows everything in a mixed graph. The user's pick carries over
when switching "Show", as long as it's available there.

**Force must be stable** before it becomes the default. The same graph should always
look the same: inline, in the maximized dialog, and after a reload. How (`arrangeForce`
in mount.ts):

- it starts from Radial (seeds in the middle) in a fixed box, not the container's, and
  runs d3-force from there (force.ts). d3-force is deterministic (its own fixed random
  generator), so the same start gives the same result, and seeds tend to stay central
- each piece is settled on its own and turned wide (not to the container's shape, so
  it doesn't matter which view lays it out), then the pieces are packed side by side,
  in Radial's order, a fixed gap apart. Settled together they'd drift apart: nothing
  links them
- if every node already has a place, nothing moves: Shared only turned on (it only
  hides nodes), drags, and maximizing (inline and maximized share their positions,
  `forcePositions`). Anything that brings in new nodes (Group or Shared only turned
  off) lays out afresh, so the picture can jump and drags are lost. Kept simple on
  purpose; if the jumps bother, start from the current positions instead, with new
  nodes placed around their known neighbours
- d3-force replaced fcose (2026-10-15), compared side by side with Cola and ELK stress
  on the fixtures in `design/force-layouts.html` (dev server). ELK stress looked best
  but took over 2 s on the largest graph, against about 100 ms; d3-force came next. Its
  settings are the page's defaults
- d3-force isn't a Cytoscape layout: `settle` takes positions and links and returns
  positions, which are set on the nodes

**Mixed graphs:** every view that's available shows the part it can, without a note
on what it leaves out (the notes were dropped 2026-10-15). Only Radial and
Force show inter-concept links.

**Terms:** a term is a search word from find_cohort_variables. Dug links variables to a
term just as it links them to a concept, so a term goes wherever a view places
concepts (`isConceptOrTerm`) and is drawn tinted: a pale amber fill with an amber
border (§4). Terms are always seeds, so they also get the seed marks.

| View | A term is shown as |
|---|---|
| Radial | a seed in the centre |
| Force | a tinted node |
| Flow | a tinted bar on the left |
| List | a tinted swatch, with "(search term)" |

A term differs from a concept only where the concept's identity is used:

- **Details:** a term has no link and no category, and is labelled "Search term".
- **Grouping:** terms are never merged into a group.
- **Inter-concept links:** a term never has one, since Dug doesn't relate search words.
  So a concept star never includes terms.

### Collapsed links in node-link

Radial and Force draw bundles by default: one link per concept and study, instead of
the variables between them.

- **Toggle:** a "Variables" checkbox, off by default, next to Group. Turning it on draws
  individual variables as now. The setting is shared by Radial and Force, and between
  the inline panel and the dialog.
- **Clicking a bundle** focuses the concept × study pair, the same as a Flow band, and the details list its variables. A bundle doesn't expand in place:
  that would add nodes and move the layout. The toggle is how you see all variables.
- **Variables without a study** bundle to the "No study provided" placeholder.
- **Graphs without studies** (search_concepts) bundle too: every concept links to the
  placeholder, as wide as its variables. Same behaviour everywhere (decided 2026-10-14,
  over showing variables with the checkbox greyed out).
- **Not drawn by default:** the blue ramp (variable weight) and halos on shared
  *variables*. Shared studies keep their halo. The legend follows the toggle, and the
  view: it lists only what the view draws, as the view draws it: variables are a band
  swatch in Flow and with bundles. Each entry is a swatch and a name, with what it
  means in a tooltip. "Queried" (a highlighted label) stands for the seeds, and its
  tooltip covers the shared halo too. Inter-concept links aren't listed: hovering one
  names it.
- **Highlighting** is computed on the full graph and mapped to bundles: a concept
  lights up its bundles and their studies, and a study lights up its bundles and their
  concepts. It matches the other views.
- **Stability:** switching adds or removes nodes, so Force lays out afresh (§2's simple
  rule); concepts and studies don't keep their places.
- **Code:** `bundles` (bundle.ts), shared with Flow, turns variable paths into bundle
  edges listing their variables (`toElements(graph, true)`; `variables` option). A bundle edge is drawn in the bundle style (flat mid-blue,
  width = count, §4), so it's never confused with an edge from Dug.

### Parked (revisit later)

- **Seed-combination chart (UpSet-style), for 2+ seeds:** one bar per combination of
  seeds, giving how many studies cover exactly that combination ("asthma and COPD: 5").
  This is what "shared" approximates.
- **Predicate sectors:** Radial for a concept star, with neighbours grouped around the
  seed by predicate. It's the node-link version of the List grouped by predicate.
- **Matrix** (built, then parked 2026-10-15: little benefit over Flow and List with the
  data we have; worth another look with many studies per answer). The design:
  - Rows are studies, then the "No study provided" placeholder; columns are concepts and
    terms, seeds first. With no studies at all, rows
    are variables and each cell is just filled or empty: grouped concepts show up as
    matching columns.
  - A term's column has a tinted header mark, and seed columns get the seed marks (§4).
  - Each cell is a circle whose **area** shows the variable count, with the largest
    filling the cell. It's solid flat mid-blue (the bundle colour). The count appears only
    in the native tooltip: "asthma × phs000001: 7 variables".
  - Rows are sorted by how many seeds they cover, then by total variables, so shared
    studies come first. Shared rows get the halo on their header.
  - Clicking a cell focuses that concept × study pair; clicking a header focuses that
    study or concept.
  - Concepts with no variables (e.g. from concept_connections) aren't drawn and get a
    "not shown" note.

## 4. Visual grammar

Mock-ups of everything here, drawn with the app's Cytoscape:
`design/seed-shared-marks.html` (run the dev server and open `/design/seed-shared-marks.html`).

Encodings come in four layers, and each channel belongs to exactly one layer, so the
marks on one node never compete:

| Layer | Facts | Channels |
|---|---|---|
| Intrinsic: category | type; real, stand-in or summary | hue, shape, fill (solid, tinted, outlined), line colour |
| Intrinsic: amount | variable weight, variable count | contrast within the blue ramp, size or width |
| Context: query | seed, shared | halo (wide or narrow), highlighted label |
| Context: interaction | focus, faded | outline ring, opacity |

Each meaning gets one encoding, and each encoding means one thing in every view.

| Layer | Encoding | Means | Where |
|---|---|---|---|
| Category | Amber `--kg-concept`, circle | concept | all |
| Category | Tinted amber fill, amber border | search term: a stand-in for a concept | all |
| Category | Green `--kg-study`, rounded square | study | all |
| Category | Blue, small circle | variable | node-link with Variables on |
| Category | Grey outline, placed last: "No study provided" | the variables without a study: a stand-in | List, Flow, node-link bundles |
| Category | Flat mid-blue (middle of the ramp) | a bundle: a summary of variables | Flow bands, node-link bundles |
| Category | Solid grey line | a stated variable edge | node-link |
| Category | Solid light-amber line (amber mixed towards the background) | an inter-concept link: concept → concept, with Dug's predicates | node-link |
| Amount | Blue ramp `--kg-variable-low → -high` | one variable; more contrast = links more concepts (`related_concepts_count`) | node-link with Variables on |
| Amount | Size / width | variable count (bundles only) | Flow band width, node-link bundle width (`1 + 2.2·√count`) |
| Query | Wide halo `--kg-halo` | seed: what a call asked about, of any type | all |
| Query | Highlighted label: `--kg-halo` behind the label text | seed | node-link, Flow, List |
| Query | Narrow halo `--kg-halo` | shared: connects two or more seeds | node-link, Flow, List (on the swatch) |
| Interaction | `--kg-selected` outline ring, outside the border | the focus itself | node-link, Flow. List: a shaded row |
| Interaction | Opacity 0.15 | faded: not connected to the focus | all but List, which fades to 0.35 |

**Values**

- **Halo:** highlighter yellow, `#fde047` at 0.45 on light and `#facc15` at 0.25 on dark.
  Not a type hue, so it says nothing about type. Easy to change: `--kg-halo` and
  `--kg-halo-opacity`.
  Node-link padding is 14 for a seed and 5 for shared; a seed that's also shared gets the
  wide one. Flow's bars are thin, so its halos are 6 and 3.
- **Highlighted label:** the halo colour at the halo's opacity behind the text, with black
  or white text, whichever reads on it over the background. Bold in the legend.
- **Selection ring:** 2px, 3px outside the shape, so the border stays free for the
  category layer: Cytoscape's `outline-*` in node-link, a separate rect in Flow.
- **Term fill:** 30% amber, 70% background; the border is full amber.
- **Inter-concept link:** 55% amber, 45% background, 1.5px.
- **Dark theme:** the blue ramp runs from low to high contrast against the background,
  so dark mode swaps its ends (`#1e40af` → `#93c5fd`). Flat mid-blue is the same in both.

**Rules**

- **One layer per channel.** Hue, shape and fill say what something is; size and ramp
  contrast say how much; halo and the highlighted label relate it to the query; the ring
  and opacity respond to the user. So size never marks a seed, and hue never marks context.
- **Opacity only ever means faded.** The exception is Flow's band translucency, which
  keeps overlapping bands readable.
- **List is a different kind of view** and marks the interaction layer its own way: the
  focus is a shaded row (not a ring, which in HTML reads as keyboard focus), and rows
  fade to 0.35, since they're text to read rather than context. Its swatches still
  follow the category and query layers, with one adaptation: a seed gets only its
  highlighted (bold) name, and a halo on a swatch means shared. Wide and narrow halos
  can't be told apart on an 8px swatch, and full-size names don't need the halo's help.
- **Outlined shapes are clickable all over:** an outlined shape has a coloured border
  and a transparent fill, but its whole area takes clicks, not just the border. In
  SVG that means `pointer-events: all` (or `fill: transparent`, never `fill: none`).
- **Seeds:** the wide halo and the highlighted label, whatever their type. Seeds keep their
  type's shape and size.
- **Labels:** every node's label is shown, truncated; the full label is in the native
  `title` inside a canvas. Shadcn tooltips only label controls; popovers hold links and
  lists.
- **Words:** use only Dug's vocabulary. Say "type", not "kind". Show predicates and
  categories verbatim.

**Deviations to fix**

- Node-link's "No study provided" uses `background-opacity: 0`: check that the inside of the
  shape takes clicks (Cytoscape probably tests the whole shape).

## 5. Selection model

There is one focus, kept by the host and shared by every view.

```ts
type KgFocus = { node: string } | { concept: string; study: string }
```

- **What lights up** comes from one place, `focusConnections` (focus.ts), and every
  view uses it, List included. Nodes and edges in the set keep their normal style;
  everything else fades. The focus itself gets the selected outline. Connected edges
  aren't restyled, and full labels aren't shown on highlight.
- **Clicking:** clicking a node, band, cell or row focuses it. Clicking it again (in the
  List) or clicking the background clears it. Highlighting is on click only, never on
  hover.
- **Switching views:** the focus carries over. A view shows its closest equivalent: a
  variable in Flow lights up its band, and a pair in node-link lights up the concept,
  study and variables between them. If a view has no equivalent, the focus stays but
  nothing in that view is highlighted.
- **Redraws:** changing Group, "Shared only" or Variables redraws the graph and keeps
  the focus where it can (`carryFocus`): a node still drawn stays focused, one merged
  moves to its group or merged release, and a group split apart moves to its first
  member or release. It clears when the node is gone (hidden by "Shared only") or a
  pair has no variables left. Switching the source is another graph, so it clears.
- **Pairs as bundles:** a pair is exactly a concept–study bundle, so Flow bands and
  node-link bundles all focus as pairs. A pair with the "No study provided"
  placeholder means the concept's variables without a study: `pairVariables` handles
  it as a special case, and the other views highlight the concept and those variables.
  **(open)** For concept–concept bundles,
  generalise the pair to `{ a, b }`, meaning two nodes and the variables on both.
- **(parked)** A seed-combination chart would need a third kind of focus: a set of
  studies.

## 6. Several calls in one graph

- `fromKgList` merges the calls' graphs by node id, and the seeds are the union of all
  calls' seeds. "Show" picks one call's graph or the merged "All results".
- **Shape:** worked out from the graph shown (§2). Views are never chosen per tool.
- **A search term and a concept are separate seeds,** even when they mean the same
  thing. A cohort_variables call plus a concept_graph call give four seeds (`asthma`,
  `COPD`, asthma, chronic obstructive pulmonary disease). A study is then "shared"
  between the term asthma and the concept asthma. The fix is to ask Dug which concept
  each search term resolved to; until then, "shared" stays as it is. Matching on labels
  isn't an option: "COPD" ≠ "chronic obstructive pulmonary disease", and terms are never
  merged by name.
  - **Meanwhile:** the bundle between the term and the concept already shows their
    overlap without claiming they're the same. In the fixtures, the term `asthma` and
    the concept asthma share 6 variables.
  - **(open)** If Dug sends the mapping, how is the term → concept edge drawn?
    - **(a)** As its own link type, "searched as", with its own encoding in §4. Both
      nodes stay, and "shared" counts them as one seed.
    - **(b)** By folding the term into its concept, keeping the search word as an
      alias in the details. Simpler to read, but it hides what the user typed and
      goes against keeping terms separate.

    The lean is (a): it keeps both nodes and states only what Dug says.
- **Disconnected parts:** separate calls can give separate pieces (e.g. concept_graph
  with concept_connections). Radial gives each piece its own centre, its seeds (or,
  without seeds, its concepts), and puts the pieces side by side: seeded pieces first,
  then the bigger, each as wide as √(its nodes) (`arrangeRadial`, radial.ts). Force
  starts from that and packs its pieces side by side the same way.
- **Uneven coverage:** if Dug returns only the top N results per call, counts from
  different calls look comparable but aren't. Ask Dug.
- **Provenance:** which call a node came from. This is parked; "Show" could become a
  filter that combines calls instead of a single switch.

## 7. Questions for Dug

- `study_id` for search_concepts variables.
- Real concept categories.
- Which concept or concepts each find_cohort_variables search term resolved to (§6).
- get_concept_connections' seed has its id as its label (check the real API against the
  stub).
- Are results capped per call, and how?

## 8. Build order

1. This spec.
2. ~~Grammar fixes~~ (done): the §4 marks in node-link, Flow and List; the "No study
   provided" placeholder in Flow and List (`NO_STUDY`, focusable like a study). Flow's
   "without a study" note went with step 5: Flow is greyed out without studies.
3. ~~Stable Force~~ (done): start from the Radial positions, a fixed seed, turned
   wide; positions kept when every node has one (maximize, drags, Shared only on).
4. ~~Collapsed links in node-link~~ (done): the default, with the Variables toggle.
5. ~~`graphShape`~~ (done): availability, the Force default, greyed-out views, the
   pick carried over. List without variables (a star): the concepts, seeds first.
6. ~~Removing the Columns layout~~ (done). The star's list became a plain list of its
   concepts in step 5; grouping it by predicate is parked.
7. ~~Matrix~~: built, then parked (§3).
8. Parked views from §3 (seed-combination chart, predicate sectors, Matrix), if they're picked up again.
