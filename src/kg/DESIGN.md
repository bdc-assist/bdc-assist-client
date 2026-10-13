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
**(planned)** turns a shape into the views on offer.

## 3. Views

| View | Needs | Shows | Leaves out (with a note) |
|---|---|---|---|
| Radial | a seed | seeds in the middle, studies around them joined by bundles (with Variables on: variables in between); inter-concept links dashed | — |
| Force | — | everything: concepts and studies joined by bundles, or individual variables with Variables on | — |
| Flow | studies | concept → study bands, width = variable count; variables without a study go to the placeholder | inter-concept links |
| Matrix **(planned)** | variables | studies × concepts (or variables × concepts when there are no studies) | concepts without variables |
| List | — | studies → concepts → variables; no studies: grouped by concept; star: grouped by predicate **(planned)** | — |

Flow and Matrix both show bundles, and both stay. Flow shows proportions: how each
concept's and each study's total splits. Matrix is for finding a value, comparing
studies, and seeing which studies cover which seeds, and it scales to many studies.

Columns (concepts | variables | studies) has been dropped. Radial and Force can show
individual variables, and the Matrix covers the no-studies case.

**Variables without a study** go under a **"No study given"** placeholder, placed last,
in List, Flow, Matrix (a row) and collapsed node-link. The placeholder belongs to the view, not the graph:
it's never a node in `KgGraph`, so nothing is inferred. It's drawn outlined in grey,
never study green. It's left out of study counts, the title summary and "shared", so it
never gets a halo. When some variables have studies and some don't, it sits alongside
the real studies. A view that needs studies (Flow) still needs at least one real study.
List's "Study not given" label is reworded to match.

Unavailable views stay in the picker, greyed out, with the reason as their tooltip
("Needs a concept that was asked about", "Needs studies", "Needs variables").

**Default view:** Force, for every shape. It's always available, and it's the only
node-link view that shows everything in a mixed graph. The user's pick carries over
when switching "Show", as long as it's available there.

**Force must be stable** before it becomes the default. The same graph should always
look the same: inline, in the maximized dialog, and after a reload. The planned
approach:

- start from the Radial positions (seeds in the middle), with a fixed random seed, so
  the result is deterministic and seeds tend to stay central
- when a toggle (Group, Shared only) redraws the graph, nodes that are still there keep
  their positions; dragged positions are kept the same way
- time it on large graphs: concept_graph_2 has 104 nodes, and each graph in the chat
  runs its own layout
- it depends on the verdict on fcose

**Mixed graphs:** every view that's available shows the part it can and notes what it
leaves out ("N relationships between concepts not shown in this view"), as Flow does
now. Force and List are the only views that show everything.

**Terms:** a term is a search word from find_cohort_variables. Dug links variables to a
term just as it links them to a concept, so a term goes wherever a view places
concepts (`isConceptOrTerm`) and is drawn outlined (§4). As a seed it's an outlined diamond.

| View | A term is shown as |
|---|---|
| Radial | a seed in the centre (terms are always seeds) |
| Force | an outlined node |
| Flow | an outlined bar on the left |
| List | an outlined swatch, with "(search term)" |
| Matrix | a column with an outlined header mark; its cells look like any other |

A term differs from a concept only where the concept's identity is used:

- **Details:** a term has no link and no category, and is labelled "Search term".
- **Grouping:** terms are never merged into a group.
- **Inter-concept links:** a term never has one, since Dug doesn't relate search words.
  So a concept star never includes terms.

### Matrix (planned)

- Rows are studies, then the "No study given" placeholder; columns are concepts and
  terms, seeds first. With no studies at all, rows
  are variables and each cell is just filled or empty: grouped concepts show up as
  matching columns.
- A term's column has an outlined header mark (an outlined diamond, since terms are seeds).
- Each cell is a circle whose **area** shows the variable count, with the largest
  filling the cell. It's solid flat mid-blue (the bundle colour). The count appears only
  in the native tooltip: "asthma × phs000001: 7 variables".
- Rows are sorted by how many seeds they cover, then by total variables, so shared
  studies come first. Shared rows get the halo on their header.
- Clicking a cell focuses that concept × study pair; clicking a header focuses that
  study or concept.
- Concepts with no variables (e.g. from concept_connections) aren't drawn and get a
  "not shown" note.

### Collapsed links in node-link (planned)

Radial and Force draw bundles by default: one link per concept and study, instead of
the variables between them.

- **Toggle:** a "Variables" checkbox, off by default, next to Group. Turning it on draws
  individual variables as now. The setting is shared by Radial and Force, and between
  the inline panel and the dialog.
- **Clicking a bundle** focuses the concept × study pair, the same as a Flow band or a
  Matrix cell, and the details list its variables. A bundle doesn't expand in place:
  that would add nodes and move the layout. The toggle is how you see all variables.
- **Variables without a study** bundle to the "No study given" placeholder.
- **Graphs without studies** (search_concepts): collapsing would leave only concept →
  placeholder. Variables are shown and the checkbox is greyed out, with the reason as
  its tooltip.
- **Not drawn by default:** the blue ramp (variable weight) and halos on shared
  *variables*. Shared studies keep their halo. The legend follows the toggle.
- **Highlighting** is computed on the full graph and mapped to bundles: a concept
  lights up its bundles and their studies, and a study lights up its bundles and their
  concepts. It matches the other views.
- **Stability:** when switching, concepts and studies keep their positions, and
  variables start between their two ends (this builds on stable Force).
- **Code:** a pure transform in `src/kg` that turns variable paths into bundle edges
  listing their variables. A bundle edge is marked so it's never confused with an edge
  from Dug.

### Other candidates (not agreed)

- **Seed-combination chart (UpSet-style), for 2+ seeds:** one bar per combination of
  seeds, giving how many studies cover exactly that combination ("asthma and COPD: 5").
  This is what "shared" approximates.
- **Predicate sectors:** Radial for a concept star, with neighbours grouped around the
  seed by predicate. It's the node-link version of the List grouped by predicate.

## 4. Visual grammar

Each meaning gets one encoding, and each encoding means one thing in every view.

| Encoding | Means | Where |
|---|---|---|
| Hue: amber `--kg-concept` | concept | all |
| Amber outline | search term | all |
| Hue: green `--kg-study` | study | all |
| Blue ramp `--kg-variable-low → -high` | one variable; darker = links more concepts (`related_concepts_count`) | node-link with Variables on |
| Flat mid-blue (mix of the two) | a bundle of variables | Flow bands, Matrix circles, node-link bundles |
| Size / width | variable count (bundles only) | Flow, Matrix, node-link bundles |
| Diamond | seed: what a call asked about | node-link, Flow, List |
| Grey outline, last: "No study given" | the variables without a study | List, Flow, Matrix, node-link bundles |
| Amber halo | shared: connects two or more seeds | node-link; Flow, List, Matrix **(planned)** |
| Solid grey line | a stated variable edge | node-link |
| Dashed amber line | an inter-concept link: concept → concept, with Dug's predicates | node-link |
| `--kg-selected` outline | the focus itself | node-link, Flow; List and Matrix **(planned)** |
| Opacity 0.15 | faded: not connected to the focus | all |

**Rules**

- **Opacity only ever means faded.** The exception is Flow's band translucency, which
  keeps overlapping bands readable. Matrix circles are solid.
- **Outlined shapes are clickable all over:** an outlined shape has a coloured border
  and a transparent fill, but its whole area takes clicks, not just the border. In
  SVG that means `pointer-events: all` (or `fill: transparent`, never `fill: none`).
- **Seeds:** drawn larger, and their label is always shown (truncated).
- **Labels:** the full label is in the native `title` inside a canvas. Shadcn tooltips
  only label controls; popovers hold links and lists.
- **Words:** use only Dug's vocabulary. Say "type", not "kind". Show predicates and
  categories verbatim.

**Deviations to fix**

- List fades to 0.35, not 0.15.
- List marks the focus with row shading instead of the `--kg-selected` outline.
  **(open)** Should an HTML list follow the canvas, or is shading the list's equivalent?
- Flow and List don't mark shared studies.
- Flow's term bars and diamonds use `fill: none`, so only their border takes clicks.
  Node-link uses `background-opacity: 0`: check that the inside of the shape takes
  clicks (Cytoscape probably tests the whole shape).
- Node-link draws inter-concept links at 0.6 opacity. **(open)** Use a lighter colour
  instead, or treat this like Flow's exception?

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
- **Redraws:** changing grouping, the source or "Shared only" redraws the graph and
  clears the focus. **(open)** Should the focus be kept when the node is still there?
- **Pairs as bundles:** a pair is exactly a concept–study bundle, so Flow bands, Matrix
  cells and node-link bundles all focus as pairs. A pair with the "No study given"
  placeholder means the concept's variables without a study: `pairVariables` handles
  it as a special case, and the other views highlight the concept and those variables.
  **(open)** For concept–concept bundles,
  generalise the pair to `{ a, b }`, meaning two nodes and the variables on both.
- **(open)** A seed-combination chart would need a third kind of focus: a set of
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
- **Disconnected parts:** separate calls can give separate pieces. Layouts should
  arrange them side by side. **(open)** Should Radial give each piece its own centre?
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
2. Grammar fixes: List fades to 0.15, shared marks in Flow and List, and outlined
   shapes clickable all over.
   The "No study given" placeholder in Flow (and List's label); remove Flow's
   "without a study" note.
3. Stable Force: start from the Radial positions, a fixed seed, positions kept across
   toggles.
4. Collapsed links in node-link, the default, with the Variables toggle.
5. `graphShape`: availability, the Force default, greyed options (views and the
   Variables toggle), the pick carried over.
6. Star list grouped by predicate, and removing the Columns layout.
7. Matrix.
8. Candidates from §3, one at a time, once agreed.
