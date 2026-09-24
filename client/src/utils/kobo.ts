/** Prices are stored as integer kobo. This is the only place they become a string. */
export function formatKobo(kobo: number): string {
  const naira = kobo / 100;
  const hasRemainder = kobo % 100 !== 0;
  return `₦${naira.toLocaleString('en-NG', {
    minimumFractionDigits: hasRemainder ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
