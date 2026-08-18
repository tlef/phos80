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

function renderImageSeg(s, opts) {
  const { src, alt, rows, treatment, link } = s.image;
  const safe = safeSrc(src);
  if (!safe) return `<span>${escapeHTML(s.text)}</span>`; // bad src → stays blank cells
  const cells = s.text.length;
  const t = TREATMENTS.has(treatment) ? treatment : 'phosphor';
  // The box is zero-height so the anchor row stays one cell tall; the frame
  // inside it is absolutely positioned and paints down over the rows the
  // layout engine reserved for it.
  const box =
    `<span class="p80-imgbox p80-t-${t}" style="width:${cells}ch">` +
    `<span class="p80-imgframe" style="height:${Math.max(1, rows || 1)}lh">` +
    `<img class="p80-img" src="${escapeHTML(safe)}" alt="${escapeHTML(alt)}" loading="lazy">` +
    `</span></span>`;
  if (link) {
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
  return box;
}

function renderSeg(s, opts) {
  if (!s.text) return '';
  if (s.image) return renderImageSeg(s, opts);
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
