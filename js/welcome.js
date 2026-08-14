// welcome.js — the initial screen's document model.
//
// Imported by main.js for hydration AND by the SSR generator that produces
// the static pre-rendered HTML in index.html. One source of truth; on a real
// backend this doc would be rendered server-side from the same code.

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
