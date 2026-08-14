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

function renderSeg(s) {
  if (!s.text) return '';
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
      const extra = safe.external ? ' target="_blank" rel="noopener"' : '';
      return `<a class="${cls.join(' ')}" href="${escapeHTML(safe.href)}"${extra}>${text}</a>`;
    }
    return `<a class="${cls.join(' ')}" href="#" data-cmd="${escapeHTML(s.href)}">${text}</a>`;
  }
  if (!cls.length) return `<span>${text}</span>`;
  return `<span class="${cls.join(' ')}">${text}</span>`;
}

/** Render lines to HTML. Merge-friendly: one <div class="p80-line"> per row. */
export function renderLines(lines) {
  return lines
    .map((line) => `<div class="p80-line">${line.map(renderSeg).join('')}</div>`)
    .join('\n');
}
