// phos80 protocol types (see PROTOCOL.md for the normative spec).
// Import these in API handlers to get compile-time checking of envelopes.

export type ColorName =
  | 'amber' | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta'
  | 'cyan' | 'white' | 'brblack' | 'brred' | 'brgreen' | 'bryellow'
  | 'brblue' | 'brmagenta' | 'brcyan' | 'brwhite';

export type Align = 'left' | 'center' | 'right';

/** Side margins in character cells: n (both) or [left, right]. All widgets. */
export type Margin = number | [number, number];

interface WidgetBase {
  margin?: Margin;
}

export interface TextWidget extends WidgetBase {
  type: 'text';
  /** BBCode-style inline markup; \n splits paragraphs; long lines wrap. */
  content: string;
  align?: Align;
}

export interface FrameWidget extends WidgetBase {
  type: 'frame';
  /** Embedded in the top border; plain unless styled with inline markup ([b], [cyan]…). */
  title?: string;
  border?: 'single' | 'double';
  /** Tints the border; also the title's default colour. */
  color?: ColorName;
  children?: Widget[];
}

export interface ColumnsWidget extends WidgetBase {
  type: 'columns';
  /** One child per column; columns stack below `min` width. */
  children: Widget[];
  /** Relative weights, like flex-grow. */
  widths?: number[];
  gap?: number;
  min?: number;
}

export interface RowWidget extends WidgetBase {
  type: 'row';
  /** BBCode strings: first flush left, last flush right, a middle one centred. */
  parts: string[];
  /** Gap fill character; default ' '. */
  fill?: string;
  /** Colour for the fill; non-space fills are dim by default. */
  fillColor?: ColorName;
}

export interface ButtonItem {
  label: string;
  /** Dispatched on click; defaults to the lowercased label. */
  command?: string;
  color?: ColorName;
}

export interface ButtonsWidget extends WidgetBase {
  type: 'buttons';
  items: ButtonItem[];
  align?: Align;
}

export interface ImageWidget extends WidgetBase {
  type: 'image';
  /** http(s) URL or scheme-less relative path. */
  src: string;
  /** Required for accessibility/SEO. */
  alt?: string;
  /** Width in character cells; default min(40, cols), clamped to viewport. */
  width?: number;
  /** Height in rows. Omit to derive it from the image's shape. */
  height?: number;
  /**
   * Intrinsic width/height ratio (e.g. 0.667 for a 2:3 poster). Lets layout
   * reserve the right number of rows before the image loads — the same job
   * HTML's width/height attributes do. Ignored once the client has measured
   * the image.
   */
  aspect?: number;
  align?: Align;
  /** 'phosphor' (default): monochrome, theme-tinted. */
  treatment?: 'phosphor' | 'pixel' | 'plain';
  /** Wraps the image; URL or command (same rules as [link=…]). */
  link?: string;
}

export interface RuleWidget extends WidgetBase {
  type: 'rule';
  char?: string;
  color?: ColorName;
}

export interface SpacerWidget extends WidgetBase {
  type: 'spacer';
  lines?: number;
}

export type Widget =
  | TextWidget
  | FrameWidget
  | ColumnsWidget
  | RowWidget
  | ButtonsWidget
  | ImageWidget
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
