// typewriter.js — progressive reveal of an ALREADY-RENDERED block.
//
// The block's final DOM (layout, links, buttons) exists before animation
// starts; we stash each text node's content, empty them, and refill a few
// characters per frame. Nothing reflows horizontally during typing, and
// interactive elements are real from frame one.
//
// - Whitespace runs are revealed for free (padding never "crawls").
// - Any keypress or pointer-down completes the reveal instantly.
// - prefers-reduced-motion: no animation at all.
// - The full plain text is written to an aria-live region up front so
//   screen readers get the response immediately.

const reduced =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)');

export function typeIn(block, { srLive, cps = 400, onTick } = {}) {
  if (srLive) srLive.textContent = block.textContent;
  if (reduced && reduced.matches) return Promise.resolve();

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n; (n = walker.nextNode()); ) nodes.push([n, n.nodeValue]);
  for (const [node] of nodes) node.nodeValue = '';

  return new Promise((resolve) => {
    let raf;
    let i = 0;
    let off = 0;
    // Time-based budget: rAF cadence is pinned to the display refresh rate
    // (~16.7ms at 60Hz, ~8.3ms at 120Hz), so speed comes from batch SIZE,
    // not tick rate — chars-per-tick = cps × elapsed seconds. This keeps
    // cps honest on any refresh rate; fractional leftovers carry over.
    let last;
    let carry = 0;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', finish, true);
      document.removeEventListener('pointerdown', finish, true);
    };
    const finish = () => {
      for (const [node, text] of nodes) node.nodeValue = text;
      cleanup();
      onTick?.();
      resolve();
    };
    document.addEventListener('keydown', finish, true);
    document.addEventListener('pointerdown', finish, true);

    const step = (now) => {
      const dt = last === undefined ? 1 / 60 : Math.min((now - last) / 1000, 0.1);
      last = now;
      carry += cps * dt;
      let budget = Math.max(1, Math.floor(carry));
      carry -= budget;
      while (budget > 0 && i < nodes.length) {
        const [node, text] = nodes[i];
        if (off >= text.length) {
          i++;
          off = 0;
          continue;
        }
        // Whitespace is free — skip past it without spending budget.
        let ws = off;
        while (ws < text.length && (text[ws] === ' ' || text[ws] === '\n')) ws++;
        if (ws > off) {
          off = ws;
          node.nodeValue = text.slice(0, off);
          continue;
        }
        const take = Math.min(budget, text.length - off);
        off += take;
        budget -= take;
        node.nodeValue = text.slice(0, off);
      }
      onTick?.();
      if (i >= nodes.length) {
        cleanup();
        resolve();
      } else {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
  });
}
