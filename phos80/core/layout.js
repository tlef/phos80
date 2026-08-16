// layout.js — widget tree → StyledLine[] at a given column count.
//
// A StyledLine is Segment[] whose visible length is EXACTLY `cols` — alignment
// and chrome are real characters (padding spaces, box-drawing borders), which
// is what makes the output behave like a genuine character terminal. Resizing
// the viewport simply re-runs this layout at a new `cols`.
//
// All functions here are pure and DOM-free (usable server-side).

import { parse } from './bbcode.js';

export const seg = (text, style = {}, extra) => ({ text, style, ...extra });

const spaces = (n) => ' '.repeat(Math.max(0, n));

/** Visible character count of a segment array. */
export const visLen = (segs) => segs.reduce((n, s) => n + s.text.length, 0);

/**
 * Slice a segment array by visible character index, splitting segments as
 * needed. Style/link/command metadata survives because segments are split,
 * never discarded.
 */
export function sliceSegs(segs, start, end = Infinity) {
  const out = [];
  let pos = 0;
  for (const s of segs) {
    const sStart = pos;
    const sEnd = pos + s.text.length;
    pos = sEnd;
    if (sEnd <= start || sStart >= end) continue;
    const from = Math.max(0, start - sStart);
    const to = Math.min(s.text.length, end - sStart);
    out.push({ ...s, text: s.text.slice(from, to) });
  }
  return out;
}

/** Pad (with literal spaces) or truncate to exactly `width`. */
export function padSegs(segs, width, align = 'left') {
  const len = visLen(segs);
  if (len > width) return sliceSegs(segs, 0, width);
  const gap = width - len;
  if (gap === 0) return segs;
  if (align === 'right') return [seg(spaces(gap)), ...segs];
  if (align === 'center') {
    const left = Math.floor(gap / 2);
    return [seg(spaces(left)), ...segs, seg(spaces(gap - left))];
  }
  return [...segs, seg(spaces(gap))];
}

/**
 * Greedy word-wrap by visible characters → Segment[][] (unpadded lines).
 * Break indices are computed on the joined plain text, then the segment
 * array is cut at those indices with sliceSegs.
 */
export function wrapSegs(segs, width) {
  const text = segs.map((s) => s.text).join('');
  if (text.length <= width) return [segs];
  const lines = [];
  let start = 0;
  while (start < text.length) {
    if (lines.length) {
      while (text[start] === ' ') start++; // eat leading spaces on continuations
      if (start >= text.length) break;
    }
    let end = start + width;
    if (end < text.length) {
      const br = text.lastIndexOf(' ', end);
      if (br > start) end = br; // soft break at a space, else hard break
    } else {
      end = text.length;
    }
    lines.push(sliceSegs(segs, start, end));
    start = end;
  }
  return lines.length ? lines : [[]];
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

// Two charsets: box-drawing glyphs, or pure ASCII (opts.borders = 'ascii')
// for fonts without box-drawing coverage — or for maximum retro.
const BORDERS = {
  unicode: {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rule: '─',
  },
  ascii: {
    single: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
    double: { tl: '+', tr: '+', bl: '+', br: '+', h: '=', v: '|' },
    rule: '-',
  },
};

/**
 * Doc { widgets: Widget[] } → StyledLine[], each exactly `cols` wide.
 * opts.borders: 'unicode' (default) | 'ascii'.
 */
export function layoutDoc(doc, cols, opts = {}) {
  const lines = [];
  for (const w of doc?.widgets ?? []) layoutWidget(w, cols, lines, opts);
  return lines;
}

function layoutWidget(w, cols, out, opts) {
  switch (w.type) {
    case 'text': {
      for (const para of String(w.content ?? '').split('\n')) {
        const segs = parse(para);
        for (const line of wrapSegs(segs, cols)) {
          out.push(padSegs(line, cols, w.align));
        }
      }
      break;
    }
    case 'spacer': {
      for (let i = 0; i < (w.lines ?? 1); i++) out.push([seg(spaces(cols))]);
      break;
    }
    case 'rule': {
      const set = BORDERS[opts?.borders] ?? BORDERS.unicode;
      const ch = (w.char ?? set.rule)[0] ?? set.rule;
      out.push([seg(ch.repeat(cols), { color: w.color, dim: w.color == null })]);
      break;
    }
    case 'frame':
      layoutFrame(w, cols, out, opts);
      break;
    case 'columns':
      layoutColumns(w, cols, out, opts);
      break;
    case 'buttons':
      layoutButtons(w, cols, out);
      break;
    default:
      out.push(padSegs(parse(`[red]?[/red] unknown widget: ${w.type}`), cols));
  }
}

function layoutFrame(w, cols, out, opts) {
  const set = BORDERS[opts?.borders] ?? BORDERS.unicode;
  const b = set[w.border] ?? set.single;
  const bs = w.color ? { color: w.color } : {};
  const inner = Math.max(1, cols - 4); // "│ content │"

  // Top border, optionally with an embedded bold title: ┌─ TITLE ────┐
  let title = w.title ? ` ${w.title} ` : '';
  const maxTitle = Math.max(0, cols - 4);
  if (title.length > maxTitle) title = title.slice(0, maxTitle);
  const fill = cols - 2 - title.length - 1; // tl + h … title … fills + tr
  const top = [seg(b.tl + b.h, bs)];
  if (title) top.push(seg(title, { ...bs, bold: true }));
  top.push(seg(b.h.repeat(Math.max(0, fill)) + b.tr, bs));
  out.push(padSegs(top, cols));

  // Children laid out at the inner width, then wrapped in border columns.
  const kid = [];
  for (const child of w.children ?? []) layoutWidget(child, inner, kid, opts);
  for (const line of kid) {
    out.push([seg(b.v + ' ', bs), ...padSegs(line, inner), seg(' ' + b.v, bs)]);
  }

  out.push([seg(b.bl + b.h.repeat(Math.max(0, cols - 2)) + b.br, bs)]);
}

/**
 * Side-by-side children — the terminal's flexbox.
 *   { type: 'columns', children: [Widget…], gap?: 2, min?: 24, widths?: [2,1] }
 *
 * As many children as fit at `min` width share a row (extra ones wrap to the
 * next row, responsive-window style); at narrow viewports everything stacks
 * full-width. `widths` are relative weights within a row.
 */
function layoutColumns(w, cols, out, opts) {
  const kids = w.children ?? [];
  if (!kids.length) return;
  const gap = w.gap ?? 2;
  const min = w.min ?? 24;
  const perRow = Math.max(1, Math.min(kids.length, Math.floor((cols + gap) / (min + gap))));

  for (let i = 0; i < kids.length; i += perRow) {
    const row = kids.slice(i, i + perRow);
    const weights = row.map((_, j) => w.widths?.[i + j] ?? 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const avail = cols - gap * (row.length - 1);

    // Weighted split of the available width; remainder goes left to right.
    const widths = weights.map((wt) => Math.floor((avail * wt) / totalWeight));
    let rem = avail - widths.reduce((a, b) => a + b, 0);
    for (let j = 0; rem > 0; j = (j + 1) % widths.length, rem--) widths[j]++;

    // Lay out each child at its column width, then zip lines horizontally,
    // padding shorter columns with blank rows.
    const blocks = row.map((child, j) => {
      const lines = [];
      layoutWidget(child, widths[j], lines, opts);
      return lines;
    });
    const height = Math.max(...blocks.map((b) => b.length));
    for (let r = 0; r < height; r++) {
      const line = [];
      blocks.forEach((b, j) => {
        if (j) line.push(seg(spaces(gap)));
        line.push(...(b[r] ?? [seg(spaces(widths[j]))]));
      });
      out.push(padSegs(line, cols));
    }
  }
}

function layoutButtons(w, cols, out) {
  const items = (w.items ?? []).map((it) =>
    seg(`[ ${it.label} ]`, { color: it.color ?? 'brwhite', bold: true }, {
      command: it.command ?? String(it.label).toLowerCase(),
    })
  );

  // Greedy row packing, two spaces between buttons.
  const rows = [];
  let row = [];
  let len = 0;
  for (const btn of items) {
    const need = (row.length ? 2 : 0) + btn.text.length;
    if (row.length && len + need > cols) {
      rows.push(row);
      row = [];
      len = 0;
    }
    if (row.length) {
      row.push(seg('  '));
      len += 2;
    }
    row.push(btn);
    len += btn.text.length;
  }
  if (row.length) rows.push(row);
  for (const r of rows) out.push(padSegs(r, cols, w.align ?? 'left'));
}
