// phosphor/ssr.js — server-side rendering (Node; no DOM required).
//
// Renders a protocol doc to the exact HTML the client produces, for SEO /
// no-JS prerenders. Embed the output inside a .p80-screen element of the
// skeleton (see USAGE.md §5), or use the CLI from any build pipeline:
//
//   node phosphor/ssr.js path/to/doc.json [cols] > screen.html

import { layoutDoc, visLen } from './core/layout.js';
import { renderLines } from './core/render.js';

/** Doc → HTML string for one screen block (innerHTML of .p80-screen). */
export function renderScreen(doc, { cols = 80 } = {}) {
  const lines = layoutDoc(doc, cols);
  assertWidth(lines, cols);
  return `<div class="p80-block">${renderLines(lines)}</div>`;
}

/** Doc → plain text at `cols`, e.g. for previews or text-only user agents. */
export function renderText(doc, { cols = 80 } = {}) {
  return layoutDoc(doc, cols)
    .map((line) => line.map((s) => s.text).join(''))
    .join('\n');
}

function assertWidth(lines, cols) {
  const bad = lines
    .map((l, i) => [i, visLen(l)])
    .filter(([, n]) => n !== cols);
  if (bad.length) {
    throw new Error(
      `phosphor: layout width violation at ${cols} cols on line(s) ${bad
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
    console.error('usage: node phosphor/ssr.js <doc.json> [cols]');
    process.exit(2);
  }
  const { readFileSync } = await import('node:fs');
  const doc = JSON.parse(readFileSync(docPath, 'utf8'));
  process.stdout.write(renderScreen(doc, { cols: Number(colsArg) || 80 }));
}
