// format rating 2 decimale dupa virgula
export function formatRatingScore(value: number | null | undefined): string {
  if (value == null) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  if (n % 1 === 0) return String(Math.round(n));
  if ((n * 10) % 1 === 0) return n.toFixed(1);
  return n.toFixed(2);
}
