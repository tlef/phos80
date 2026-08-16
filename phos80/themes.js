// phos80/themes.js — palette presets, named after real CRT phosphors.
//
// A theme is a full palette: background, foreground ('amber' is the protocol
// name for the default foreground, whatever its actual hue), and all 16
// accent colors — each preset's accents are tuned to sit in that phosphor's
// temperature, which is why presets live here rather than asking sites to
// override 19 variables by hand.
//
// Isomorphic: themeVars() lets a server inline the same custom properties
// into SSR markup so a non-default theme doesn't flash on load.

export const THEMES = {
  // P3 phosphor — Wyse/IBM amber. The stylesheet's built-in defaults.
  amber: {
    bg: '#0d0805', bgDeep: '#050302', amber: '#ffb000',
    black: '#2a1f14', red: '#ff5f56', green: '#7dff8a', yellow: '#ffd75f',
    blue: '#6ea8ff', magenta: '#ff7ae2', cyan: '#7de8ff', white: '#e8dcc8',
    brblack: '#8a7660', brred: '#ff938c', brgreen: '#b5ffbe', bryellow: '#ffe89e',
    brblue: '#9cc4ff', brmagenta: '#ffa8ec', brcyan: '#b0f1ff', brwhite: '#fff6e3',
  },
  // P1 phosphor — Apple II / VT100 green on black.
  green: {
    bg: '#040f07', bgDeep: '#010502', amber: '#3bff72',
    black: '#123320', red: '#ff6f61', green: '#8dffab', yellow: '#d8ff6e',
    blue: '#59c8ff', magenta: '#ff7ede', cyan: '#69ffd9', white: '#d9f5e0',
    brblack: '#568a68', brred: '#ff9c92', brgreen: '#bfffd0', bryellow: '#eaffa8',
    brblue: '#93dcff', brmagenta: '#ffabe9', brcyan: '#a5ffe8', brwhite: '#f0fff4',
  },
  // P4 phosphor — paper-white (VT320, early Macs).
  white: {
    bg: '#0b0b0d', bgDeep: '#040405', amber: '#e6e6df',
    black: '#2a2a30', red: '#ff655b', green: '#72e886', yellow: '#ffd75f',
    blue: '#6ea8ff', magenta: '#ff7ae2', cyan: '#6fd8e8', white: '#f0f0ea',
    brblack: '#8f8f98', brred: '#ff958d', brgreen: '#a8ffb8', bryellow: '#ffe89e',
    brblue: '#9cc4ff', brmagenta: '#ffa8ec', brcyan: '#aee8f2', brwhite: '#ffffff',
  },
  // Cool blue-white tubes.
  ice: {
    bg: '#04070f', bgDeep: '#010208', amber: '#c9e2ff',
    black: '#16222f', red: '#ff6b70', green: '#74e8a0', yellow: '#ffe08a',
    blue: '#7ab5ff', magenta: '#d99cff', cyan: '#8ff0ff', white: '#e4f0ff',
    brblack: '#6b7f95', brred: '#ff9ba0', brgreen: '#a8ffc8', bryellow: '#fff0b8',
    brblue: '#a8d0ff', brmagenta: '#e8c0ff', brcyan: '#c4f8ff', brwhite: '#f4faff',
  },
};

const VAR_NAME = (key) => `--p80-${key === 'bgDeep' ? 'bg-deep' : key}`;

/**
 * Resolve a theme config to a { '--p80-*': value } map.
 * Accepts a preset name ('green'), or { preset?, colors? } where colors
 * override individual palette keys (or add 'font').
 */
export function themeVars(theme) {
  const t = typeof theme === 'string' ? { preset: theme } : theme ?? {};
  const preset = THEMES[t.preset ?? 'amber'];
  if (!preset) throw new Error(`phos80: unknown theme preset "${t.preset}"`);
  const colors = { ...preset, ...t.colors };
  const vars = {};
  for (const [key, value] of Object.entries(colors)) vars[VAR_NAME(key)] = value;
  return vars;
}

/** themeVars() as a CSS declaration string, for inlining into SSR markup. */
export function themeCSS(theme) {
  return Object.entries(themeVars(theme))
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}
