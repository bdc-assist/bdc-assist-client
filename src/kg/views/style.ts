import type { EdgeSingular, StylesheetJson } from 'cytoscape'

import { AMOUNTS, HALO_PAD, resolvedColors } from './marks'

/** mountGraph's Cytoscape style, with the --kg-* colours read from `el` (see marks.ts).
 * Exported for pages that draw toElements' elements their own way (e.g.
 * design/force-layouts.html). */
export function styleFor(el: HTMLElement): StylesheetJson {
  const css = getComputedStyle(el)
  const c = resolvedColors(el)
  const halo = c.halo
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-family': css.fontFamily,
        'font-size': 10,
        color: c.label,
        'text-valign': 'bottom',
        'text-margin-y': 3,
        'text-wrap': 'ellipsis',
        'text-max-width': '110px',
        width: 12,
        height: 12,
      },
    },
    {
      selector: 'node[type = "concept"], node[type = "term"]',
      style: {
        'background-color': c.concept,
        width: 24,
        height: 24,
        'font-size': 12,
        'font-weight': 'bold',
        'text-max-width': '200px',
      },
    },
    {
      // a search word standing in for a concept: tinted, with a border in the concept colour
      selector: 'node[type = "term"]',
      style: { 'background-color': c.term, 'border-width': 2, 'border-color': c.concept },
    },
    {
      selector: 'node[type = "variable"]',
      style: { 'background-color': (n) => c.variable(n.data('weight') ?? 1) },
    },
    {
      selector: 'node[type = "study"]',
      style: { 'background-color': c.study, shape: 'round-rectangle', width: 16, height: 16 },
    },
    {
      // "No study provided": a stand-in, not a study: outlined in grey, never study green.
      // Filled with the background, not left clear, so it still looks outlined but hides
      // the round ends of the bundles that reach under it
      selector: 'node.placeholder',
      style: {
        'background-color': c.background,
        'border-width': 1.5,
        'border-color': c.label,
      },
    },
    {
      // round ends reach under the node: a wide bundle's flat end stops at the node's edge,
      // leaving its corners off the curve
      selector: 'edge',
      style: { width: 1, 'line-color': c.edge, 'curve-style': 'straight', 'line-cap': 'round' },
    },
    {
      // a concept's variables in one study: flat mid-blue (a summary of variables, as
      // Flow's bands), as wide as there are (area-like: 1 + 2.2·√count)
      selector: 'edge.bundle',
      style: {
        'line-color': c.band,
        width: (e: EdgeSingular) => 1 + 2.2 * Math.sqrt(e.data('count') as number),
      },
    },
    {
      // concept → concept: a light tint of the concept colour (not opacity: that means faded)
      selector: 'edge.relation',
      style: { 'line-color': c.relation, width: 1.5 },
    },
    {
      // connects two or more seeds (shared): a narrow halo
      selector: 'node.bridge',
      style: {
        'underlay-color': halo.color,
        'underlay-padding': HALO_PAD.graph.shared,
        'underlay-opacity': halo.opacity,
        'underlay-shape': 'ellipse',
      },
    },
    {
      // what a call asked about (the API's seeds), of any type: a wide halo, and the
      // label highlighted in the same colour. After .bridge, so a shared seed gets the wide one
      selector: 'node[?seed]',
      style: {
        'underlay-color': halo.color,
        'underlay-padding': HALO_PAD.graph.seed,
        'underlay-opacity': halo.opacity,
        'underlay-shape': 'ellipse',
        'text-background-color': halo.color,
        'text-background-opacity': halo.opacity,
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle', // the types only know the old spelling
        color: halo.text, // black or white, for the highlight as it looks over the background
        'text-margin-y': 5,
      },
    },
    { selector: 'node.bridge[type = "study"], node[?seed][type = "study"]', style: { 'underlay-shape': 'round-rectangle' } },
    { selector: '.faded', style: { opacity: AMOUNTS.faded } },
    {
      // the focus: a ring outside the node, leaving the border to the node's type (terms)
      selector: 'node:selected',
      style: { 'outline-width': 2, 'outline-color': c.selected, 'outline-offset': 3, 'outline-opacity': 1 },
    },
  ]
}
