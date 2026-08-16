// Types for phos80/ssr — server-side rendering (Node, no DOM).

import type { Doc } from './protocol.js';

export interface RenderOptions {
  /** Column count to lay out at. Default 80. */
  cols?: number;
  /** Charset for frames/rules. Default 'unicode'. */
  borders?: 'unicode' | 'ascii';
  /** Target for http(s) links. Default '_blank'. */
  externalLinks?: '_blank' | '_self';
}

/**
 * Doc → HTML string for one screen block (the innerHTML of .p80-screen).
 * Throws if any laid-out line violates the width invariant.
 */
export function renderScreen(doc: Doc, opts?: RenderOptions): string;

/** Doc → plain text, e.g. for previews or text-only user agents. */
export function renderText(doc: Doc, opts?: RenderOptions): string;
