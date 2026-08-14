// phos80 protocol types (see PROTOCOL.md for the normative spec).
// Import these in API handlers to get compile-time checking of envelopes.

export type ColorName =
  | 'amber' | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta'
  | 'cyan' | 'white' | 'brblack' | 'brred' | 'brgreen' | 'bryellow'
  | 'brblue' | 'brmagenta' | 'brcyan' | 'brwhite';

export type Align = 'left' | 'center' | 'right';

export interface TextWidget {
  type: 'text';
  /** BBCode-style inline markup; \n splits paragraphs; long lines wrap. */
  content: string;
  align?: Align;
}

export interface FrameWidget {
  type: 'frame';
  title?: string;
  border?: 'single' | 'double';
  color?: ColorName;
  children?: Widget[];
}

export interface ColumnsWidget {
  type: 'columns';
  /** One child per column; columns stack below `min` width. */
  children: Widget[];
  /** Relative weights, like flex-grow. */
  widths?: number[];
  gap?: number;
  min?: number;
}

export interface ButtonItem {
  label: string;
  /** Dispatched on click; defaults to the lowercased label. */
  command?: string;
  color?: ColorName;
}

export interface ButtonsWidget {
  type: 'buttons';
  items: ButtonItem[];
  align?: Align;
}

export interface RuleWidget {
  type: 'rule';
  char?: string;
  color?: ColorName;
}

export interface SpacerWidget {
  type: 'spacer';
  lines?: number;
}

export type Widget =
  | TextWidget
  | FrameWidget
  | ColumnsWidget
  | ButtonsWidget
  | RuleWidget
  | SpacerWidget;

export interface Doc {
  widgets: Widget[];
  /** Optional header install (same semantics as Envelope.header). */
  header?: Doc | null;
}

export interface Envelope {
  ok: boolean;
  doc: Doc;
  /**
   * Sticky page-mode header: a doc replaces it, null restores the site
   * default, absent leaves it unchanged.
   */
  header?: Doc | null;
}
