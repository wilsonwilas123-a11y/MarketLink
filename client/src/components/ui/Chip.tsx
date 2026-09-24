import type { ButtonHTMLAttributes } from 'react';

export function Chip({
  active = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      aria-pressed={active}
      className={`h-8 rounded-full border px-3 text-sm transition ${
        active
          ? 'border-accent/50 bg-accent-soft text-accent'
          : 'border-line bg-elevated text-muted hover:text-primary'
      } ${className}`}
    >
      {children}
    </button>
  );
}
