'use client';

import { ArrowSquareOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

const TAKEOUT_URL =
  'https://takeout.google.com/settings/takeout/custom/youtube';

const STEPS = [
  {
    title: 'Open Google Takeout',
    description:
      'Go to the YouTube data export page on Google Takeout using the button below.',
  },
  {
    title: 'Select Watch Later playlist',
    description:
      'Deselect all data, then expand YouTube and select only the "Watch Later" playlist for export.',
  },
  {
    title: 'Export and download',
    description:
      'Click "Create export" and wait for the download link. Google will email you when it is ready.',
  },
  {
    title: 'Upload here',
    description:
      'Upload the downloaded .zip file directly — we will find the right file automatically. You can also extract and upload the CSV yourself.',
  },
];

export function TakeoutGuide() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div>
        <h2 className="text-sm font-medium text-foreground">
          How to export your Watch Later playlist
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          YouTube does not allow apps to read your Watch Later playlist directly.
          You can export it via Google Takeout instead.
        </p>
      </div>

      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <a href={TAKEOUT_URL} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" className="w-full sm:w-auto">
          <ArrowSquareOut size={18} />
          Open Google Takeout
        </Button>
      </a>
    </div>
  );
}
