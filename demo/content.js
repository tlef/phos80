// demo/content.js — the demo site's content docs.
//
// SITE content, not framework code: everything here is plain protocol JSON
// (see PROTOCOL.md). A real site would produce docs like these server-side.
// Imported by demo.js for hydration AND by tools/gen-ssr.mjs to prerender
// demo/index.html — one source of truth.

export const WELCOME_DOC = {
  widgets: [
    { type: 'spacer' },
    { type: 'text', align: 'center', content: '[bryellow][b]░▒▓█  P R O J E C T   8 0 s  █▓▒░[/b][/bryellow]' },
    { type: 'text', align: 'center', content: '[dim]AMBER PHOSPHOR TERMINAL · EST. 2026[/dim]' },
    { type: 'spacer' },
    {
      type: 'frame',
      border: 'double',
      title: 'SYSTEM',
      children: [
        { type: 'text', content: 'Welcome to a modern website that thinks it is 1983.' },
        { type: 'spacer' },
        {
          type: 'text',
          content:
            'Every frame, border and margin on this screen is drawn with real ' +
            'characters — box glyphs and padding spaces — and re-drawn from its ' +
            'document model whenever the window resizes. Type a command below, ' +
            'or press a button.',
        },
        { type: 'spacer' },
        { type: 'text', align: 'right', content: '[dim]last login:[/dim] [cyan]2026-08-11[/cyan] [dim]on ttyS0[/dim]' },
      ],
    },
    { type: 'spacer' },
    {
      type: 'buttons',
      align: 'center',
      items: [
        { label: 'HELP' },
        { label: 'ABOUT' },
        { label: 'NEWS', command: 'news 1' },
        { label: 'PAGE MODE', command: 'mode page' },
      ],
    },
    { type: 'spacer' },
    {
      type: 'text',
      align: 'center',
      content: '[dim]curious?[/dim] [link=https://en.wikipedia.org/wiki/Computer_terminal]what is a terminal?[/link]',
    },
  ],
};

// Default header shown above the screen in page mode (the news pages install
// their own via the response's `header` field; `header: null` restores this).
export const HEADER_DOC = {
  widgets: [
    {
      type: 'columns',
      min: 12,
      children: [
        { type: 'text', content: '[bryellow][b]▓▒░ PROJECT 80s[/b][/bryellow]' },
        { type: 'text', align: 'right', content: '[dim]sys[/dim] [green]OK[/green] · [cyan]ttyS0[/cyan]' },
      ],
    },
    { type: 'rule', char: '═' },
  ],
};
