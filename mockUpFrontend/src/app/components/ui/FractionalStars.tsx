import { useId } from 'react';

const STAR_PATH =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

const FILLED = '#5f4731'; // brand-500
const EMPTY = '#f2ddce';  // brand-100

/**
 * Renders 5 stars with fractional fill states (0%, 25%, 50%, 75%, 100%).
 * The rating is snapped to the nearest 0.25 before rendering.
 */
export function FractionalStars({ rating, className }: { rating: number; className?: string }) {
  const id = useId();
  const rounded = Math.round((rating ?? 0) * 4) / 4;

  return (
    <div className={`flex gap-1${className ? ` ${className}` : ''}`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, rounded - i));
        const pct = `${fill * 100}%`;
        const gradId = `${id}-sg-${i}`;
        return (
          <svg key={i} width="20" height="20" viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset={pct} stopColor={FILLED} />
                <stop offset={pct} stopColor={EMPTY} />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${gradId})`} />
          </svg>
        );
      })}
    </div>
  );
}
