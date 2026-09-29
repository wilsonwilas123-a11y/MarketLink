import type { ButtonHTMLAttributes } from 'react';
import { LoadingDots } from '../../motion/LoadingDots';
import { animateInteraction } from '../../motion/interaction';
import { CircularSpinner } from './CircularSpinner';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';


const variant: Record<Variant, string> = {
  primary: 'bg-block text-on-block font-bold shadow-[0_8px_24px_rgba(33,106,73,0.16)] hover:brightness-105 active:translate-y-px',
  ghost: 'border border-line bg-elevated/55 text-primary hover:border-muted/70 hover:bg-elevated',
  danger: 'border border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700',
};

const size: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5',
};


export function buttonClass(v: Variant = 'primary', s: Size = 'md', className = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-xl transition-[background,color,border-color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-45 ${size[s]} ${variant[v]} ${className}`;
}

export function Button({
  variant: v = 'primary',
  size: s = 'md',
  loading = false,
  loadingIndicator = 'dots',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingIndicator?: 'dots' | 'spinner';
}) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      onPointerEnter={(event) => {
        rest.onPointerEnter?.(event);
        if (loading || event.pointerType !== 'mouse') return;
        animateInteraction(event.currentTarget, 'button-enter');
      }}
      onPointerLeave={(event) => {
        rest.onPointerLeave?.(event);
        if (event.pointerType === 'mouse') animateInteraction(event.currentTarget, 'button-leave');
      }}
      className={buttonClass(v, s, className)}
    >
      {loading ? (
        loadingIndicator === 'spinner'
          ? <CircularSpinner className="mr-1" />
          : <LoadingDots className="mr-1" dotClassName="h-1.5 w-1.5" />
      ) : null}
      {children}
    </button>
  );
}
