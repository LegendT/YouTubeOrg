'use client';

const shortcuts = [
  { key: 'Tab', description: 'Navigate' },
  { key: 'Enter', description: 'Open' },
  { key: 'A', description: 'Accept' },
  { key: 'R', description: 'Reject' },
  { key: '← →', description: 'Prev/Next' },
  { key: '?', description: 'All shortcuts' },
];

export function KeyboardHints() {
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg z-50">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {shortcuts.map((shortcut, i) => (
          <span key={shortcut.key} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-border">·</span>}
            <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 font-mono text-muted-foreground">
              {shortcut.key}
            </kbd>
            {shortcut.description}
          </span>
        ))}
      </div>
    </div>
  );
}
