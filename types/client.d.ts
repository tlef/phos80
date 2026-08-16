// Types for phos80/client — createTerminal().

import type { Doc, Envelope } from './protocol.js';
import type { Theme } from './themes.js';

export interface TerminalSettings {
  /** Grid clamp, in character cells. Default 80. */
  maxCols?: number;
  /** Default 20. */
  minCols?: number;
  /** Typewriter reveal speed, chars/sec; 0 = instant. Default 10000. */
  typeCps?: number;
  /** Default 1000. */
  maxScrollback?: number;
  /** Default 'scroll'. */
  mode?: 'scroll' | 'page';
  /** Charset for frames/rules. Default 'unicode'. */
  borderSet?: 'unicode' | 'ascii';
  /** Focus the prompt on load / after commands (fine-pointer only). Default true. */
  autoFocus?: boolean;
  /** Clicking empty screen space focuses the prompt. Default true. */
  focusOnClick?: boolean;
  /** Echo commands into the scrollback (scroll mode). Default true. */
  echo?: boolean;
  /** localStorage key suffix to persist command history. Default null (off). */
  historyKey?: string | null;
  /** Target for http(s) links. Default '_blank'. */
  externalLinks?: '_blank' | '_self';
}

export interface TerminalChrome {
  /** Prompt glyph. Default '>'. */
  prompt?: string;
  placeholder?: string;
  /** aria-label for the input. Default 'command input'. */
  inputLabel?: string;
  /** Default page-mode header doc (site content). */
  header?: Doc | null;
  /** The "80 COLS" corner badge. Default true. */
  colsBadge?: boolean;
  /** BBCode strings or full docs. */
  notices?: {
    modeScroll?: string | Doc;
    modePage?: string | Doc;
    modeUsage?: string | Doc;
  };
  errors?: {
    /** Shown when transport throws/rejects. */
    transport?: (err: unknown) => Doc;
  };
}

export type LocalCommand = (
  args: string[],
  term: TerminalInstance
) => Doc | string | null | undefined | Promise<Doc | string | null | undefined>;

export interface TerminalConfig {
  /** Host element. A prerendered [data-p80="crt"] skeleton is adopted. */
  mount: HTMLElement;
  /** The site's API: command string in, envelope out. */
  transport: (cmd: string) => Promise<Envelope>;
  /** First screen (usually the doc the server prerendered). */
  initialDoc?: Doc | null;
  settings?: TerminalSettings;
  chrome?: TerminalChrome;
  /**
   * Client-side commands. `clear: true` / `mode: true` enable the built-ins
   * (default on; false sends them to transport); a function adds a local
   * command.
   */
  commands?: Record<string, boolean | LocalCommand>;
  /**
   * Palette preset name or { preset, colors, effects }. When omitted, the
   * stylesheet defaults (and site CSS variable overrides) apply.
   */
  theme?: Theme;
}

export interface TerminalInstance {
  dispatch(cmd: string): Promise<void>;
  print(doc: Doc): Promise<void>;
  setHeader(doc: Doc | null): void;
  setMode(mode: 'scroll' | 'page'): Promise<void>;
  /** Apply a theme at runtime; null restores the stylesheet defaults. */
  setTheme(theme: Theme | null): void;
  clear(): void;
  focus(): void;
  remeasure(): void;
  readonly mode: 'scroll' | 'page';
  readonly cols: number;
  destroy(): void;
}

export function createTerminal(config: TerminalConfig): TerminalInstance;
