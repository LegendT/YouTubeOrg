'use client';

const shortcuts = [
  { key: 'Tab', description: 'Navigate grid' },
  { key: 'Enter', description: 'Open video' },
  { key: 'A', description: 'Accept suggestion' },
  { key: 'R', description: 'Reject suggestion' },
  { key: '\u2190 \u2192', description: 'Navigate modal' },
  { key: 'Esc', description: 'Close modal' },
];

export function KeyboardHints() {
  return (
    <div className="fixed bottom-4 right-4 bg-card border rounded-lg p-4 shadow-lg z-50">
      <h4 className="text-sm font-semibold mb-2">Keyboard Shortcuts</h4>
      <div className="divide-y divide-border">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.key}
            className="flex items-center justify-between gap-4 py-1.5"
          >
            <kbd className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs font-mono">
              {shortcut.key}
            </kbd>
            <span className="text-xs text-muted-foreground">
              {shortcut.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
