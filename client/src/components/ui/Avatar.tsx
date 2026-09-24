export function Avatar({ src, size = 40 }: { src?: string | null; size?: number }) {
  const box = { width: size, height: size };

  if (src) {
    return <img src={src} alt="" style={box} className="rounded-full object-cover" />;
  }

  return (
    <span
      role="img"
      aria-label="No photo"
      style={box}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-elevated text-muted"
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
      </svg>
    </span>
  );
}
