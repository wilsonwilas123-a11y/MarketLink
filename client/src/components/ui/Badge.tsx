import type { ReactNode } from 'react';

const tones = {
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn/10 text-warn',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-elevated text-muted',
} as const;

export function Badge({ tone = 'muted', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
