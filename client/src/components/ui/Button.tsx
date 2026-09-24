import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variant: Record<Variant, string> = {
  primary: 'bg-accent text-ink font-semibold hover:brightness-110',
  ghost: 'border border-line bg-transparent text-primary hover:bg-elevated',
  danger: 'border border-danger/40 bg-danger/15 text-danger hover:bg-danger/25',
};

const size: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5',
};

/**
 * The recipe, on its own.
 *
 * A route that navigates is a link, not a button that navigates, so anything styled like a
 * button and pointing at a URL needs these classes without the `<button>` element.
 */
export function buttonClass(v: Variant = 'primary', s: Size = 'md', className = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-full transition disabled:pointer-events-none disabled:opacity-50 ${size[s]} ${variant[v]} ${className}`;
}

export function Button({
  variant: v = 'primary',
  size: s = 'md',
  loading = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      className={buttonClass(v, s, className)}
    >
      {loading ? <span aria-hidden>…</span> : null}
      {children}
    </button>
  );
}
