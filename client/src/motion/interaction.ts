type Interaction = 'card-enter' | 'card-leave' | 'button-enter' | 'button-leave';

let runtime: Promise<typeof import('gsap')> | undefined;
const revisions = new WeakMap<Element, number>();

/** Load GSAP only after an actual pointer interaction, keeping the first page payload lean. */
export function animateInteraction(target: HTMLElement, interaction: Interaction) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const revision = (revisions.get(target) ?? 0) + 1;
  revisions.set(target, revision);
  runtime ??= import('gsap');

  void runtime.then(({ default: gsap }) => {
    if (revisions.get(target) !== revision) return;

    const entering = interaction.endsWith('enter');
    const card = interaction.startsWith('card');
    gsap.to(target, {
      y: entering ? (card ? -3 : -1) : 0,
      scale: entering ? (card ? 1.006 : 1.015) : 1,
      ...(card && entering ? {
        borderColor: 'color-mix(in oklab, var(--color-accent) 30%, var(--color-line))',
        boxShadow: '0 20px 48px rgb(21 39 29 / 0.13)',
      } : {}),
      ...(!entering ? { clearProps: card ? 'transform,borderColor,boxShadow' : 'transform' } : {}),
      duration: entering ? (card ? 0.24 : 0.18) : (card ? 0.28 : 0.2),
      ease: 'power2.out',
      overwrite: 'auto',
    });
  });
}
