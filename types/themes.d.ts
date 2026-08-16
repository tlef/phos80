// Types for phos80/themes — palette presets and SSR helpers.

export type ThemeName = 'amber' | 'green' | 'white' | 'ice';

export type PaletteKey =
  | 'bg' | 'bgDeep' | 'amber'
  | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
  | 'brblack' | 'brred' | 'brgreen' | 'bryellow' | 'brblue' | 'brmagenta'
  | 'brcyan' | 'brwhite';

export type Palette = Record<PaletteKey, string>;

export interface ThemeEffects {
  /** false = off, true = full, number = 0..1 intensity. */
  scanlines?: boolean | number;
  vignette?: boolean | number;
  glow?: boolean | number;
  /** false disables the overlay flicker animation. */
  flicker?: boolean;
}

export interface ThemeConfig {
  preset?: ThemeName;
  /** Override individual palette entries (or add 'font'). */
  colors?: Partial<Palette> & { font?: string };
  effects?: ThemeEffects;
}

export type Theme = ThemeName | ThemeConfig;

export const THEMES: Record<ThemeName, Palette>;

/** Resolve a theme to a { '--p80-*': value } custom-property map. */
export function themeVars(theme: Theme): Record<string, string>;

/** themeVars() as a CSS declaration string, for inlining into SSR markup. */
export function themeCSS(theme: Theme): string;
