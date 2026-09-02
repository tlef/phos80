// render.js — StyledLine[] → escaped HTML string.
//
// This is the entire "SSR surface": a pure string-to-string function with no
// DOM dependency, so the same module can run in Node to pre-render index.html.
// Every character of segment text and every attribute value is HTML-escaped —
// there is no path from API text to markup.
//
// Interactive segments become REAL focusable elements styled as plain
// characters:
//   { command } → <button data-cmd="…">           (dispatched via delegation)
//   { href }    → <a href="…"> for /path or http(s)://…,
//                 <a data-cmd="…"> for bare command words (e.g. [link=help])

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// All classes are p80- prefixed so the framework never collides with host
// site styles.
function classesFor(style = {}) {
  const cls = [];
  if (style.color && style.color !== 'amber') cls.push('p80-c-' + style.color);
  if (style.bold) cls.push('p80-b');
  if (style.dim) cls.push('p80-dim');
  if (style.underline) cls.push('p80-u');
  if (style.inverse) cls.push('p80-inv');
  if (style.blink) cls.push('p80-blink');
  return cls;
}

/** Allow only relative paths and http(s) URLs; anything else is a command. */
function safeHref(href) {
  const h = String(href);
  if (/^https?:\/\//i.test(h)) return { href: h, external: true };
  if (h.startsWith('/')) return { href: h, external: false };
  return null;
}

/** Images may come from http(s) or scheme-less relative paths only. */
function safeSrc(src) {
  const h = String(src);
  if (/^https?:\/\//i.test(h)) return h;
  if (!h.includes(':')) return h;
  return null;
}

const TREATMENTS = new Set(['phosphor', 'pixel', 'plain']);

/** Wrap a grid-box in its link, if any (URL or command, like [link=…]). */
function linkBox(box, link, opts) {
  if (!link) return box;
  const sh = safeHref(link);
  if (sh) {
    const extra =
      sh.external && (opts?.externalLinks ?? '_blank') === '_blank'
        ? ' target="_blank" rel="noopener"'
        : '';
    return `<a class="p80-imglink" href="${escapeHTML(sh.href)}"${extra}>${box}</a>`;
  }
  return `<a class="p80-imglink" href="#" data-cmd="${escapeHTML(link)}">${box}</a>`;
}

/**
 * The box occupying a reserved rectangle: it sits on the anchor row with
 * zero height (so that row stays one cell tall) and the absolutely
 * positioned frame inside it paints down over the rows layout reserved.
 */
const gridBox = (cls, cells, rows, inner) =>
  `<span class="p80-imgbox ${cls}" style="width:${cells}ch">` +
  `<span class="p80-imgframe" style="height:${Math.max(1, rows || 1)}lh">${inner}</span></span>`;

const pct = (f) => `${Math.round(f * 1000) / 10}%`;

function renderImageSeg(s, opts) {
  const { src, alt, rows, focus, treatment, link } = s.image;
  const safe = safeSrc(src);
  if (!safe) return `<span>${escapeHTML(s.text)}</span>`; // bad src → stays blank cells
  const t = TREATMENTS.has(treatment) ? treatment : 'phosphor';
  // `focus` steers the cover-crop: the point stays as central as the
  // reserved rows allow (object-position is clamped, like our vector crop).
  const pos = focus ? ` style="object-position:${pct(focus[0])} ${pct(focus[1])}"` : '';
  const img = `<img class="p80-img" src="${escapeHTML(safe)}" alt="${escapeHTML(alt)}" loading="lazy"${pos}>`;
  return linkBox(gridBox(`p80-t-${t}`, s.text.length, rows, img), link, opts);
}

// --- Vector drawings ----------------------------------------------------
//
// Shapes arrive as data and leave as SVG built from a fixed set of elements
// and attributes; every number is validated, every string escaped, and path
// data is limited to the path-command alphabet. There is no way to smuggle
// an element, an event handler or a URL through a shape.

const VECTOR_COLORS = new Set([
  'amber', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brblack', 'brred', 'brgreen', 'bryellow', 'brblue', 'brmagenta', 'brcyan', 'brwhite',
  'bg',
]);
const PATH_DATA = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,\s+-]*$/;
const ANCHORS = new Set(['start', 'middle', 'end']);

/** Palette name → CSS variable; 'none' passes through; unknown → fallback. */
function vecColor(c, fallback) {
  if (c == null) return fallback;
  if (c === 'none') return 'none';
  return VECTOR_COLORS.has(c) ? `var(--${c})` : fallback;
}

/** Number → short attribute text (3 decimals, no exponent), or null. */
const num = (v) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : null);
const nums = (a, n) => {
  if (!Array.isArray(a) || a.length < n) return null;
  const out = a.slice(0, n).map(num);
  return out.includes(null) ? null : out;
};

function shapeStyle(sh, dfltStroke, dfltFill) {
  let a = ` stroke="${vecColor(sh.stroke, dfltStroke)}" fill="${vecColor(sh.fill, dfltFill)}"`;
  if (Number.isFinite(sh.strokeWidth) && sh.strokeWidth >= 0) a += ` stroke-width="${num(sh.strokeWidth)}"`;
  if (sh.dash) a += ' stroke-dasharray="4 3"';
  if (sh.dim) a += ' opacity="0.5"';
  return a;
}

function renderShape(sh, rowUnit) {
  if (!sh || typeof sh !== 'object') return '';
  const style = () => shapeStyle(sh, 'var(--amber)', 'none');
  let v;
  if (typeof sh.path === 'string') {
    if (!PATH_DATA.test(sh.path)) return '';
    return `<path d="${escapeHTML(sh.path.trim())}"${style()}/>`;
  }
  if (Array.isArray(sh.points)) {
    const pts = sh.points.map((p) => nums(p, 2));
    if (pts.length < 2 || pts.includes(null)) return '';
    const tag = sh.close ? 'polygon' : 'polyline';
    return `<${tag} points="${pts.map((p) => p.join(',')).join(' ')}"${style()}/>`;
  }
  if ((v = nums(sh.line, 4))) {
    return `<line x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}"${style()}/>`;
  }
  if ((v = nums(sh.rect, 4))) {
    return `<rect x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}"${style()}/>`;
  }
  if ((v = nums(sh.circle, 3))) {
    return `<circle cx="${v[0]}" cy="${v[1]}" r="${v[2]}"${style()}/>`;
  }
  if (typeof sh.text === 'string' && (v = nums(sh.at, 2))) {
    // `size` is in terminal rows (default 1), so labels stay the size of
    // the surrounding text at every crop — layout supplied the row unit.
    const size = Number.isFinite(sh.size) && sh.size > 0 ? sh.size : 1;
    const fs = num(rowUnit * size * 0.8);
    const anchor = ANCHORS.has(sh.anchor) ? sh.anchor : 'start';
    const bold = sh.bold ? ' font-weight="bold"' : '';
    const dim = sh.dim ? ' opacity="0.5"' : '';
    return (
      `<text x="${v[0]}" y="${v[1]}" font-size="${fs}" text-anchor="${anchor}"` +
      ` fill="${vecColor(sh.color ?? sh.fill, 'var(--amber)')}"${bold}${dim}>${escapeHTML(sh.text)}</text>`
    );
  }
  return '';
}

function renderVectorSeg(s, opts) {
  const { viewBox, rowUnit, shapes, alt, rows, link } = s.vector;
  const vb = nums(viewBox, 4);
  if (!vb) return `<span>${escapeHTML(s.text)}</span>`;
  const body = shapes.map((sh) => renderShape(sh, rowUnit)).join('');
  const label = alt ? ` role="img" aria-label="${escapeHTML(alt)}"` : ' aria-hidden="true"';
  // The window already has the box's aspect; `slice` absorbs the sub-row
  // residue exactly as object-fit: cover does for rasters.
  const svg =
    `<svg class="p80-svg" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid slice"${label}>` +
    (alt ? `<title>${escapeHTML(alt)}</title>` : '') +
    `${body}</svg>`;
  return linkBox(gridBox('p80-t-vector', s.text.length, rows, svg), link, opts);
}
function renderSeg(s, opts) {
  if (!s.text) return '';
  if (s.image) return renderImageSeg(s, opts);
  if (s.vector) return renderVectorSeg(s, opts);
  const text = escapeHTML(s.text);
  const cls = classesFor(s.style);

  if (s.command != null) {
    cls.unshift('p80-btn');
    return `<button type="button" class="${cls.join(' ')}" data-cmd="${escapeHTML(s.command)}">${text}</button>`;
  }
  if (s.href != null) {
    cls.unshift('p80-link');
    const safe = safeHref(s.href);
    if (safe) {
      const target = opts?.externalLinks ?? '_blank';
      const extra = safe.external && target === '_blank' ? ' target="_blank" rel="noopener"' : '';
      return `<a class="${cls.join(' ')}" href="${escapeHTML(safe.href)}"${extra}>${text}</a>`;
    }
    return `<a class="${cls.join(' ')}" href="#" data-cmd="${escapeHTML(s.href)}">${text}</a>`;
  }
  if (!cls.length) return `<span>${text}</span>`;
  return `<span class="${cls.join(' ')}">${text}</span>`;
}

/**
 * Render lines to HTML. Merge-friendly: one <div class="p80-line"> per row.
 * opts.externalLinks: '_blank' (default) | '_self'.
 */
export function renderLines(lines, opts) {
  return lines
    .map((line) => `<div class="p80-line">${line.map((s) => renderSeg(s, opts)).join('')}</div>`)
    .join('\n');
}
