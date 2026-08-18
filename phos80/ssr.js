// phos80/ssr.js — server-side rendering (Node; no DOM required).
//
// Renders a protocol doc to the exact HTML the client produces, for SEO /
// no-JS prerenders. Embed the output inside a .p80-screen element of the
// skeleton (see USAGE.md §5), or use the CLI from any build pipeline:
//
//   node phos80/ssr.js path/to/doc.json [cols] > screen.html

import { layoutDoc, visLen } from './core/layout.js';
import { renderLines } from './core/render.js';

/**
 * Doc → HTML string for one screen block (innerHTML of .p80-screen).
 * opts: cols (default 80), borders ('unicode' | 'ascii'),
 * externalLinks ('_blank' | '_self'), and for images: cellRatio (charW/lineH,
 * default 0.5) plus imageSizes ({ src: { w, h } }) so images reserve the right
 * number of rows server-side. Without either, images fall back to their
 * `aspect` hint or a square.
 */
export function renderScreen(
  doc,
  { cols = 80, borders, externalLinks, cellRatio, imageSizes } = {}
) {
  const lines = layoutDoc(doc, cols, { borders, cellRatio, imageSizes });
  assertWidth(lines, cols);
  return `<div class="p80-block">${renderLines(lines, { externalLinks })}</div>`;
}

/** Doc → plain text at `cols`, e.g. for previews or text-only user agents. */
export function renderText(doc, { cols = 80, borders, cellRatio, imageSizes } = {}) {
  return layoutDoc(doc, cols, { borders, cellRatio, imageSizes })
    .map((line) => line.map((s) => s.text).join(''))
    .join('\n');
}

function assertWidth(lines, cols) {
  const bad = lines
    .map((l, i) => [i, visLen(l)])
    .filter(([, n]) => n !== cols);
  if (bad.length) {
    throw new Error(
      `phos80: layout width violation at ${cols} cols on line(s) ${bad
        .map(([i, n]) => `${i} (${n})`)
        .join(', ')}`
    );
  }
}

// --- CLI ---------------------------------------------------------------

const isCLI =
  typeof process !== 'undefined' &&
  process.argv?.[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isCLI) {
  const [, , docPath, colsArg] = process.argv;
  if (!docPath) {
    console.error('usage: node phos80/ssr.js <doc.json> [cols]');
    process.exit(2);
  }
  const { readFileSync } = await import('node:fs');
  const doc = JSON.parse(readFileSync(docPath, 'utf8'));
  process.stdout.write(renderScreen(doc, { cols: Number(colsArg) || 80 }));
}
