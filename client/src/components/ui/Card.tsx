import type { ReactNode } from 'react';
import { animateInteraction } from '../../motion/interaction';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-gsap-card
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') animateInteraction(event.currentTarget, 'card-enter');
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') animateInteraction(event.currentTarget, 'card-leave');
      }}
      className={`motion-card rounded-2xl border border-line bg-surface shadow-[0_12px_36px_rgba(21,39,29,0.07)] ${className}`}
    >
      {children}
    </div>
  );
}
