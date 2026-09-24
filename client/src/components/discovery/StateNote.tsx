import { Button } from '../ui/Button';

/**
 * Loading, empty and failed, in one shape.
 *
 * Three separate treatments is three chances for a screen to look finished while saying
 * nothing. Each case states what happened and what to do next, because "No markets found"
 * gives a shopper nothing to act on — the empty answer is only useful if it names the
 * filter that produced it.
 */
export function StateNote({
  label,
  body,
  retry,
}: {
  label: string;
  body: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3">
      <p className="text-sm">
        <span className="font-medium text-primary">{label}</span>
        <span className="text-muted"> — {body}</span>
      </p>
      {retry ? (
        <Button size="sm" variant="ghost" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** A rail or grid that is still filling in, holding its height so the page cannot jump. */
export function SkeletonRow({ count, className = '' }: { count: number; className?: string }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-24 rounded-2xl border border-line bg-surface/50" />
      ))}
    </div>
  );
}
