import type { ButtonHTMLAttributes } from 'react';

/** The recipe on its own, so a chip that points at a URL can be an `<a>` and not a button. */
export function chipClass(active = false, className = ''): string {
  return `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
    active
      ? 'border-accent/50 bg-accent-soft text-accent'
      : 'border-line bg-elevated text-muted hover:text-primary'
  } ${className}`;
}

export function Chip({
  active = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button {...rest} aria-pressed={active} className={chipClass(active, className)}>
      {children}
    </button>
  );
}
