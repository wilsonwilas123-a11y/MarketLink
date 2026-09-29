import { useEffect, useState, type ComponentType } from 'react';

type SceneKind = 'farm' | 'admin';
type SceneProps = { kind: SceneKind; className?: string };

export function DeferredMarketLinkScene(props: SceneProps) {
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return;

    const timer = window.setTimeout(() => {
      void import('./MarketLinkScene')
        .then((module) => setScene(() => module.MarketLinkScene))
        .catch(() => setScene(null));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return Scene ? <Scene {...props} /> : null;
}
