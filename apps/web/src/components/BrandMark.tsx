import { useId } from 'react';

interface BrandMarkProps {
  className?: string;
  title?: string;
}

/**
 * The Nexora N. Two uprights with a heavy diagonal between them, drawn here so
 * the project never depends on an external logo asset.
 */
export function BrandMark({
  className = 'h-9 w-9',
  title = 'Nexora Technologies',
}: BrandMarkProps) {
  const gradientId = `nexora-mark-${useId().replace(/:/g, '')}`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={title} className={className}>
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="6"
          x2="44"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0066FF" />
          <stop offset="1" stopColor="#00D4FF" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="7" height="32" rx="1.5" fill={`url(#${gradientId})`} />
      <path d="M15 8h7l19 32h-7L15 8Z" fill={`url(#${gradientId})`} />
      <rect x="33" y="8" width="7" height="32" rx="1.5" fill={`url(#${gradientId})`} />
    </svg>
  );
}
