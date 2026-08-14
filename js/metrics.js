// metrics.js — character-cell measurement for the terminal grid.
//
// A hidden probe element (100 × '0' in the real terminal font, inside the
// real container) gives a fractional character width that reflects actual
// CSS — letter-spacing, font features, the resolved font — where
// canvas.measureText can drift.

export const MIN_COLS = 20;

/** Measure the character cell inside `container`. → { charW, lineH } */
export function measureChar(container) {
  const probe = document.createElement('span');
  probe.className = 'measure-probe';
  probe.textContent = '0'.repeat(100);
  container.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { charW: rect.width / 100 || 8, lineH: rect.height || 16 };
}

/** Columns that fit in `availPx` at `charW`, floored, clamped to [MIN_COLS, maxCols]. */
export function computeCols(availPx, charW, maxCols = Infinity) {
  return Math.max(MIN_COLS, Math.min(maxCols, Math.floor(availPx / charW)));
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
