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
    <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg p-4 shadow-lg z-50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h4>
      </div>
      <div className="space-y-1.5">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.key}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-sm text-muted-foreground">
              {shortcut.description}
            </span>
            <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Press <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">?</kbd> for all shortcuts
        </p>
      </div>
    </div>
  );
}
