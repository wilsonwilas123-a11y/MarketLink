import type { ButtonHTMLAttributes } from 'react';

/**
 * The recipe on its own, so a chip that points at a URL can be an `<a>` and not a button.
 *
 * Chips are filters, not decoration. An unset one is a word with a hairline around it; the one
 * thing you have filtered by is the only one that goes solid.
 */
export function chipClass(active = false, className = ''): string {
  return `inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
    active
      ? 'border-block bg-block text-on-block font-semibold'
      : 'border-line bg-elevated/70 text-muted hover:border-paper/35 hover:text-primary'
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
