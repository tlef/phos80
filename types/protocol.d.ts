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

export interface CodeWidget extends WidgetBase {
  type: 'code';
  /**
   * Preformatted source. \n separates logical lines; leading whitespace is
   * kept, tabs expand to 4-column stops, and nothing soft-wraps at spaces.
   * Over-wide lines continue on the next row, indented to the line's own
   * indent and marked (dim ↪). Takes the same inline markup as text — that
   * is how the producer supplies syntax colouring; phos80 highlights nothing.
   */
  content: string;
  /** Dim right-aligned line numbers, sized to the line count, inside the width. */
  gutter?: boolean;
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
  /**
   * The subject, as fractions (0–1) of the image's width and height. When
   * `height` gives the image a different shape than its own, the cover-crop
   * keeps this point in view instead of the centre.
   */
  focus?: [number, number];
  /** 'phosphor' (default): monochrome, theme-tinted. */
  treatment?: 'phosphor' | 'pixel' | 'plain';
  /** Wraps the image; URL or command (same rules as [link=…]). */
  link?: string;
}

/** Palette name, the background, or nothing. */
export type VectorColor = ColorName | 'bg' | 'none';

interface ShapeStyle {
  /** Default 'amber' (the theme foreground). */
  stroke?: VectorColor;
  /** Default 'none'. */
  fill?: VectorColor;
  /** In pixels, constant at every zoom (default 1.5). */
  strokeWidth?: number;
  dash?: boolean;
  dim?: boolean;
}

/** One geometry key per shape, in viewBox units. */
export type VectorShape =
  | (ShapeStyle & { /** SVG path data (M/L/C/Q/A/Z…), nothing else. */ path: string })
  | (ShapeStyle & { /** Polyline; `close` makes it a polygon. */ points: [number, number][]; close?: boolean })
  | (ShapeStyle & { line: [number, number, number, number] })
  | (ShapeStyle & { rect: [number, number, number, number] })
  | (ShapeStyle & { circle: [number, number, number] })
  | {
      text: string;
      at: [number, number];
      /** In terminal rows (default 1) — labels stay text-sized at every crop. */
      size?: number;
      anchor?: 'start' | 'middle' | 'end';
      color?: VectorColor;
      bold?: boolean;
      dim?: boolean;
    };

export interface VectorWidget extends WidgetBase {
  type: 'vector';
  /** The drawing's coordinate space: [x, y, width, height]. */
  viewBox: [number, number, number, number];
  shapes: VectorShape[];
  /** Describes the drawing for assistive tech / SEO. */
  alt?: string;
  /** Width in character cells; default the full width, clamped to viewport. */
  width?: number;
  /**
   * Height in rows. Omit to derive it from the viewBox's shape (no cropping
   * then); set it to give the drawing a fixed band and let `focus` choose
   * what that band shows at each width.
   */
  height?: number;
  /**
   * What the crop keeps in view, in viewBox units. A rect [x, y, w, h] must
   * stay visible (the window is the smallest one of the box's shape that
   * contains it); a point [x, y] means cover the box and keep the point as
   * central as the edges allow; absent means the whole drawing.
   */
  focus?: [number, number] | [number, number, number, number];
  align?: Align;
  /** Wraps the drawing; URL or command (same rules as [link=…]). */
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
  | CodeWidget
  | FrameWidget
  | ColumnsWidget
  | RowWidget
  | ButtonsWidget
  | ImageWidget
  | VectorWidget
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
