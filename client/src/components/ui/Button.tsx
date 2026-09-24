import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

/**
 * Two buttons, not a family.
 *
 * `primary` is a pill of white with the page's black punched into it — the only thing on a screen
 * allowed to be solid. `ghost` is a hairline the same colour as the type. The sign blue is kept
 * off both: it belongs to the one fact that matters, not to the chrome.
 */
const variant: Record<Variant, string> = {
  primary: 'bg-block text-on-block font-semibold hover:bg-block/85 active:translate-y-px',
  ghost: 'border border-paper/25 bg-transparent text-primary hover:border-paper/60',
  danger: 'border border-danger/45 bg-transparent text-danger hover:bg-danger/10',
};

const size: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-sm',
  md: 'h-11 px-5',
};

/**
 * The recipe, on its own.
 *
 * A route that navigates is a link, not a button that navigates, so anything styled like a
 * button and pointing at a URL needs these classes without the `<button>` element.
 */
export function buttonClass(v: Variant = 'primary', s: Size = 'md', className = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-full transition-colors disabled:pointer-events-none disabled:opacity-45 ${size[s]} ${variant[v]} ${className}`;
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
