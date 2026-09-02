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

/**
 * Expand tabs to `tab`-column stops, tracking the visible column across
 * segments — a tab is one JS character but many cells, which would break the
 * width invariant if it reached the renderer.
 */
export function expandTabs(segs, tab = 4) {
  let col = 0;
  return segs.map((s) => {
    if (!s.text.includes('\t')) {
      col += s.text.length;
      return s;
    }
    let text = '';
    for (let i = 0; i < s.text.length; i++) {
      const ch = s.text[i];
      if (ch === '\t') {
        const n = tab - (col % tab);
        text += spaces(n);
        col += n;
      } else {
        text += ch;
        col++;
      }
    }
    return { ...s, text };
  });
}

/**
 * Hard-wrap ONE logical code line at `width` → Segment[][] (unpadded rows).
 * Unlike wrapSegs there is no soft break at spaces and nothing is eaten: an
 * over-wide line continues on the next row, indented to its own leading
 * whitespace and prefixed with a dim `mark`, so a continuation can't be
 * mistaken for a new statement at that indent. Every character of the
 * source survives — what a real terminal does, minus the ambiguity.
 *
 * The continuation prefix is capped so at least min(8, width) cells of code
 * remain on each row; only if the width can't hold the marker plus that
 * minimum does the marker go too.
 */
export function wrapCodeSegs(segs, width, mark = '↪') {
  const text = segs.map((s) => s.text).join('');
  if (text.length <= width) return [segs];
  const minCode = Math.min(8, Math.max(1, width));
  let lead = mark ? mark + ' ' : '';
  if (width - lead.length < minCode) lead = '';
  const indentLen = /^ */.exec(text)[0].length;
  const indent = Math.max(0, Math.min(indentLen, width - lead.length - minCode));
  const avail = width - indent - lead.length;

  const rows = [sliceSegs(segs, 0, width)];
  for (let start = width; start < text.length; start += avail) {
    const row = [];
    if (indent) row.push(seg(spaces(indent)));
    if (lead) row.push(seg(lead, { dim: true }));
    row.push(...sliceSegs(segs, start, start + avail));
    rows.push(row);
  }
  return rows;
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
    wrap: '↪', // continuation marker for over-wide code lines
  },
  ascii: {
    single: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
    double: { tl: '+', tr: '+', bl: '+', br: '+', h: '=', v: '|' },
    rule: '-',
    wrap: '>',
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

/** margin: number (both sides) or [left, right], in character cells. */
function normMargin(margin, cols) {
  let left = 0;
  let right = 0;
  if (typeof margin === 'number') left = right = Math.max(0, Math.floor(margin));
  else if (Array.isArray(margin)) {
    left = Math.max(0, Math.floor(margin[0] ?? 0));
    right = Math.max(0, Math.floor(margin[1] ?? 0));
  }
  // Collapse gracefully at narrow widths: keep at least 8 cells of content,
  // shrinking both margins proportionally.
  const maxTotal = Math.max(0, cols - 8);
  const total = left + right;
  if (total > maxTotal) {
    const scale = total ? maxTotal / total : 0;
    left = Math.floor(left * scale);
    right = Math.floor(right * scale);
  }
  return [left, right];
}

function layoutWidget(w, cols, out, opts) {
  // Universal margin support: lay the widget out at the reduced width, then
  // pad each line with literal space cells. Works for every widget type.
  const [ml, mr] = normMargin(w.margin, cols);
  if (ml || mr) {
    const inner = cols - ml - mr;
    const tmp = [];
    layoutWidget({ ...w, margin: 0 }, inner, tmp, opts);
    for (const line of tmp) {
      out.push([...(ml ? [seg(spaces(ml))] : []), ...line, ...(mr ? [seg(spaces(mr))] : [])]);
    }
    return;
  }

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
    case 'code':
      layoutCode(w, cols, out, opts);
      break;
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
    case 'image':
      layoutImage(w, cols, out, opts);
      break;
    case 'vector':
      layoutVector(w, cols, out, opts);
      break;
    case 'columns':
      layoutColumns(w, cols, out, opts);
      break;
    case 'row':
      layoutRow(w, cols, out);
      break;
    case 'buttons':
      layoutButtons(w, cols, out);
      break;
    default:
      out.push(padSegs(parse(`[red]?[/red] unknown widget: ${w.type}`), cols));
  }
}

/**
 * Preformatted code — text that must not reflow.
 *   { type: 'code', content: 'BBCode string', gutter?: boolean }
 * Every `\n`-separated line is one logical line, laid out verbatim: leading
 * whitespace is kept, tabs expand to 4-column stops, nothing soft-wraps at
 * spaces. Lines wider than the widget continue on the next row (see
 * wrapCodeSegs). Inline markup works as in `text` — that is how the producer
 * supplies syntax colouring; phos80 tokenises nothing. `gutter: true` adds
 * dim right-aligned line numbers, sized to the line count, inside the width.
 */
function layoutCode(w, cols, out, opts) {
  const set = BORDERS[opts?.borders] ?? BORDERS.unicode;
  const lines = String(w.content ?? '').split(/\r?\n/);
  const digits = String(lines.length).length;
  const gutterW = digits + 3; // "NN │ "
  // A gutter that would leave fewer than 4 cells of code is dropped.
  const gutter = Boolean(w.gutter) && cols - gutterW >= 4;
  const inner = gutter ? cols - gutterW : cols;
  const gutterSeg = (label) => seg(label.padStart(digits) + ' ' + set.single.v + ' ', { dim: true });

  lines.forEach((src, i) => {
    const segs = expandTabs(parse(src));
    wrapCodeSegs(segs, inner, set.wrap).forEach((row, j) => {
      const body = padSegs(row, inner);
      out.push(gutter ? [gutterSeg(j === 0 ? String(i + 1) : ''), ...body] : body);
    });
  });
}

function layoutFrame(w, cols, out, opts) {
  const set = BORDERS[opts?.borders] ?? BORDERS.unicode;
  const b = set[w.border] ?? set.single;
  const bs = w.color ? { color: w.color } : {};
  const inner = Math.max(1, cols - 4); // "│ content │"

  // Top border, optionally with an embedded title: ┌─ TITLE ────┐
  // Titles accept the same inline markup as text content and inherit only the
  // frame's colour — style them explicitly ([b]TITLE[/b], [cyan]…[/cyan]).
  const maxTitle = Math.max(0, cols - 4);
  let titleSegs = [];
  if (w.title) {
    const base = { ...bs };
    const runs = parse(String(w.title)).map((s) => ({ ...s, style: { ...base, ...s.style } }));
    titleSegs = [seg(' ', bs), ...runs, seg(' ', bs)];
    if (visLen(titleSegs) > maxTitle) titleSegs = sliceSegs(titleSegs, 0, maxTitle);
  }
  const fill = cols - 2 - visLen(titleSegs) - 1; // tl + h … title … fills + tr
  const top = [seg(b.tl + b.h, bs), ...titleSegs, seg(b.h.repeat(Math.max(0, fill)) + b.tr, bs)];
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
 * One line, parts pushed to the edges — the terminal status-bar/leader idiom:
 *   { type: 'row', parts: ['[b]help[/b]', 'this screen'], fill: '.', pad: 1 }
 * First part flush left, last flush right, a middle part centred; the gaps
 * are filled with `fill` (default space). `pad` — n, or [after-left,
 * before-right] — is the number of space cells between a part and the fill
 * on each side of every gap, so content needn't carry its own spacing.
 * Unlike `columns`, widths come from the content, not a proportional split.
 * If the parts can't fit on one line they stack, each keeping its edge
 * alignment.
 */
function layoutRow(w, cols, out) {
  const parts = (w.parts ?? []).map((p) => parse(String(p ?? '')));
  if (!parts.length) return;
  if (parts.length === 1) {
    for (const line of wrapSegs(parts[0], cols)) out.push(padSegs(line, cols));
    return;
  }

  const fillChar = (w.fill ?? ' ')[0] ?? ' ';
  const fillStyle = w.fillColor ? { color: w.fillColor } : fillChar === ' ' ? {} : { dim: true };
  const [pl, pr] = normPad(w.pad);
  // A gap: padding spaces, the fill, padding spaces. Padding is plain space
  // cells, so a space fill is unaffected by it.
  const fillSeg = (n) => {
    const fill = n - pl - pr;
    if (fill < 0) return seg(spaces(n));
    return [
      ...(pl ? [seg(spaces(pl))] : []),
      seg(fillChar.repeat(fill), fillStyle),
      ...(pr ? [seg(spaces(pr))] : []),
    ];
  };
  const lens = parts.map(visLen);
  const total = lens.reduce((a, b) => a + b, 0);
  const gaps = parts.length - 1;

  // Doesn't fit (each gap needs its padding plus one fill cell): stack instead.
  if (total + gaps * (pl + pr + 1) > cols) {
    parts.forEach((p, i) => {
      const align = i === 0 ? 'left' : i === parts.length - 1 ? 'right' : 'center';
      for (const line of wrapSegs(p, cols)) out.push(padSegs(line, cols, align));
    });
    return;
  }

  // Three parts: centre the middle one properly, when the gaps allow.
  if (parts.length === 3) {
    const midStart = Math.floor((cols - lens[1]) / 2);
    const g1 = midStart - lens[0];
    const g2 = cols - midStart - lens[1] - lens[2];
    if (g1 >= pl + pr + 1 && g2 >= pl + pr + 1) {
      out.push([...parts[0], ...fillSeg(g1), ...parts[1], ...fillSeg(g2), ...parts[2]]);
      return;
    }
  }

  // Otherwise spread the slack evenly, leftmost gaps taking the remainder.
  const slack = cols - total;
  const base = Math.floor(slack / gaps);
  let extra = slack - base * gaps;
  const line = [];
  parts.forEach((p, i) => {
    if (i) line.push(...fillSeg(base + (extra-- > 0 ? 1 : 0)));
    line.push(...p);
  });
  out.push(line);
}

/** pad: number (both sides of the fill) or [after-left, before-right]. */
function normPad(pad) {
  if (typeof pad === 'number') return [Math.max(0, Math.floor(pad)), Math.max(0, Math.floor(pad))];
  if (Array.isArray(pad)) {
    return [Math.max(0, Math.floor(pad[0] ?? 0)), Math.max(0, Math.floor(pad[1] ?? 0))];
  }
  return [0, 0];
}

/** Fallback cell shape (charW / lineH) when the caller can't measure one. */
const DEFAULT_CELL_RATIO = 0.5;

const lookupSize = (sizes, src) =>
  sizes instanceof Map ? sizes.get(src) : sizes?.[src];

/**
 * How many whole rows an image occupies. Explicit `height` wins; otherwise
 * derive it from the image's shape — measured intrinsic size if the caller
 * supplied a size cache, else the `aspect` (width/height) hint, else square.
 */
function imageRows(w, cells, opts) {
  if (Number.isFinite(w.height) && w.height > 0) return Math.max(1, Math.round(w.height));
  const ratio = opts?.cellRatio > 0 ? opts.cellRatio : DEFAULT_CELL_RATIO;
  const nat = lookupSize(opts?.imageSizes, String(w.src));
  let aspect = nat?.w > 0 && nat?.h > 0 ? nat.w / nat.h : null;
  if (!aspect && Number.isFinite(w.aspect) && w.aspect > 0) aspect = w.aspect;
  return Math.max(1, Math.round((cells * ratio) / (aspect ?? 1)));
}

/**
 * Inline image, grid-snapped. It reserves a real RECTANGLE of cells: `width`
 * cells wide and N rows tall, every row a line of literal spaces. Because the
 * rows exist in the model, frames draw borders down both sides of the image,
 * columns stay row-aligned beside it, and the width invariant is untouched —
 * the renderer paints one <img> over the reserved area.
 *   { type: 'image', src, alt?, width?, height?, aspect?, align?,
 *     focus?: [x, y], treatment?: 'phosphor'|'pixel'|'plain', link? }
 * `focus` (fractions of the image's width/height) is the point the crop
 * keeps in view when the reserved rows don't match the image's shape.
 */
function layoutImage(w, cols, out, opts) {
  if (!w.src) return;
  const cells = Math.max(4, Math.min(cols, w.width ?? Math.min(40, cols)));
  const rows = imageRows(w, cells, opts);
  const anchor = {
    text: ' '.repeat(cells),
    style: {},
    image: {
      src: String(w.src),
      alt: w.alt ?? '',
      rows,
      focus: focusPoint(w.focus),
      treatment: w.treatment,
      link: w.link,
    },
  };
  out.push(padSegs([anchor], cols, w.align));
  // Remaining rows are plain reserved cells, padded identically so the
  // rectangle stays flush under the anchor row.
  for (let i = 1; i < rows; i++) {
    out.push(padSegs([seg(spaces(cells))], cols, w.align));
  }
}

/** [x, y] with both finite → clamped to 0..1; anything else → null. */
function focusPoint(f) {
  if (!Array.isArray(f) || !Number.isFinite(f[0]) || !Number.isFinite(f[1])) return null;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return [clamp(f[0]), clamp(f[1])];
}

const finiteList = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(Number.isFinite);

/**
 * The window of a drawing that a box of a given pixel aspect ratio shows —
 * a viewBox, computed from the model so it re-crops at every column count
 * exactly the way text re-wraps.
 *   viewBox: [x, y, w, h] — the drawing's own coordinate space.
 *   focus:   [x, y, w, h] — the region that must stay visible: the window is
 *            the smallest one at `aspect` that contains it (so a small focus
 *            zooms in, a large one zooms out). Absent → the whole drawing.
 *            [x, y] — a point: the drawing covers the box (largest window
 *            that fits inside it), positioned to keep the point central.
 *   aspect:  box width ÷ height in pixels.
 * The window is centred on the focus, then slid back inside the drawing
 * when it fits (the same clamp `object-position` applies to a raster);
 * if it's larger than the drawing on an axis, it's centred on that axis.
 */
export function vectorWindow(viewBox, focus, aspect) {
  const [vx, vy, vw, vh] = viewBox;
  const A = aspect > 0 ? aspect : 1;
  let fx, fy, fw, fh;
  if (finiteList(focus, 4)) {
    [fx, fy] = focus;
    fw = Math.max(0, focus[2]);
    fh = Math.max(0, focus[3]);
  } else if (finiteList(focus, 2)) {
    [fx, fy] = focus;
    fw = fh = 0;
  } else {
    [fx, fy, fw, fh] = viewBox;
  }
  let ww, wh;
  if (fw <= 0 && fh <= 0) {
    // Point focus → cover: the largest window the drawing can fill.
    if (vw / vh > A) [ww, wh] = [vh * A, vh];
    else [ww, wh] = [vw, vw / A];
  } else if (fw > fh * A) [ww, wh] = [fw, fw / A];
  else [ww, wh] = [fh * A, fh];
  const place = (c, size, v0, v1) =>
    size <= v1 - v0 ? Math.min(v1 - size, Math.max(v0, c - size / 2)) : v0 + (v1 - v0 - size) / 2;
  return [
    place(fx + fw / 2, ww, vx, vx + vw),
    place(fy + fh / 2, wh, vy, vy + vh),
    ww,
    wh,
  ];
}

/**
 * Vector drawing, grid-snapped and art-directed. Like `image` it reserves a
 * real rectangle of cells (`width` cells wide, default the full width; N rows
 * tall from `height`, else from the drawing's shape), but the picture is
 * shapes in a `viewBox`, rendered inline as SVG in the theme's colours. The
 * viewBox the renderer gets is the crop window this layout picks for the
 * box's pixel shape (cells × cellRatio : rows) around `focus` — see
 * vectorWindow — so narrowing the terminal re-crops the drawing instead of
 * squashing it.
 *   { type: 'vector', viewBox: [x, y, w, h], shapes: Shape[], alt?,
 *     width?, height?, focus?: [x, y] | [x, y, w, h], align?, link? }
 * Shape (one geometry key + optional style):
 *   { path: 'M…' } | { points: [[x, y]…], close? } | { line: [x1, y1, x2, y2] }
 *   | { rect: [x, y, w, h] } | { circle: [cx, cy, r] }
 *   | { text: '…', at: [x, y], size?: rows, anchor?: 'start'|'middle'|'end', bold? }
 *   style: stroke?: color|'none', fill?: color|'none', strokeWidth?: px, dash?, dim?
 */
function layoutVector(w, cols, out, opts) {
  if (!finiteList(w.viewBox, 4) || !(w.viewBox[2] > 0) || !(w.viewBox[3] > 0)) return;
  const viewBox = w.viewBox.slice(0, 4);
  const cells = Math.max(4, Math.min(cols, w.width ?? cols));
  const ratio = opts?.cellRatio > 0 ? opts.cellRatio : DEFAULT_CELL_RATIO;
  const rows =
    Number.isFinite(w.height) && w.height > 0
      ? Math.max(1, Math.round(w.height))
      : Math.max(1, Math.round((cells * ratio * viewBox[3]) / viewBox[2]));
  const win = vectorWindow(viewBox, w.focus, (cells * ratio) / rows);
  const anchor = {
    text: ' '.repeat(cells),
    style: {},
    vector: {
      viewBox: win,
      // One terminal row, in drawing units at this crop: text sizes and
      // anything else that should stay grid-relative scale by it.
      rowUnit: win[3] / rows,
      shapes: Array.isArray(w.shapes) ? w.shapes : [],
      alt: w.alt ?? '',
      rows,
      link: w.link,
    },
  };
  out.push(padSegs([anchor], cols, w.align));
  for (let i = 1; i < rows; i++) {
    out.push(padSegs([seg(spaces(cells))], cols, w.align));
  }
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
