import React from 'react';

/**
 * Vrindaonline gem mark — a faceted brilliant-cut diamond.
 *
 * By default it renders in the brand orange palette. Pass `monochrome` to make
 * every facet inherit `currentColor` (with varying opacity for depth) so the
 * mark can adapt to a themed context, e.g. a vendor storefront accent colour.
 */
export function LogoMark({
  className = 'h-8 w-8',
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  if (monochrome) {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <polygon points="11,4 16,4 16,12 3,12" fill="currentColor" fillOpacity="0.95" />
        <polygon points="16,4 21,4 29,12 16,12" fill="currentColor" fillOpacity="0.8" />
        <polygon points="3,12 16,12 16,29" fill="currentColor" fillOpacity="0.7" />
        <polygon points="16,12 29,12 16,29" fill="currentColor" fillOpacity="0.5" />
        <path
          d="M11 4 H21 L29 12 L16 29 L3 12 Z M16 4 V12 M16 12 V29 M3 12 H29"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      {/* crown facets (top band) */}
      <polygon points="11,4 16,4 16,12 3,12" fill="#FF7A3C" />
      <polygon points="16,4 21,4 29,12 16,12" fill="#F1641E" />
      {/* pavilion facets (lower point) */}
      <polygon points="3,12 16,12 16,29" fill="#F1641E" />
      <polygon points="16,12 29,12 16,29" fill="#D5530F" />
      {/* facet highlights */}
      <path d="M16 4 V12 M16 12 V29 M3 12 H29" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="0.6" />
      {/* crisp outline */}
      <path
        d="M11 4 H21 L29 12 L16 29 L3 12 Z"
        stroke="#A33F08"
        strokeOpacity="0.35"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full Vrindaonline logo lockup: gem mark + wordmark.
 *
 * Defaults match the storefront header (orange gem, display-serif wordmark in
 * brand orange). Override `textClassName` / `markClassName` per surface, set
 * `monochrome` + `style={{ color }}` for themed contexts, or `showText={false}`
 * for an icon-only mark.
 */
export function Logo({
  className = '',
  textClassName = 'font-display text-3xl text-brand-600 leading-none',
  markClassName = 'h-8 w-8',
  showText = true,
  monochrome = false,
  style,
}: {
  className?: string;
  textClassName?: string;
  markClassName?: string;
  showText?: boolean;
  monochrome?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={style}>
      <LogoMark className={markClassName} monochrome={monochrome} />
      {showText && <span className={textClassName}>Vrindaonline</span>}
    </span>
  );
}
