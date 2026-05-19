// Pure constants — no 'use client', safe to import in server components,
// API routes, utility functions, and client components alike.

export const CURRENCIES = {
  INR: { symbol: '₹',    rate: 1,      locale: 'en-IN' },
  USD: { symbol: '$',    rate: 0.012,  locale: 'en-US' },
  GBP: { symbol: '£',   rate: 0.0095, locale: 'en-GB' },
  EUR: { symbol: '€',   rate: 0.011,  locale: 'de-DE' },
  AED: { symbol: 'د.إ', rate: 0.044,  locale: 'ar-AE' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Convert an INR amount to the selected currency and format it. */
export function formatPrice(inrAmount: number | string, code: CurrencyCode): string {
  const { symbol, rate, locale } = CURRENCIES[code];
  const value = Number(inrAmount) * rate;
  return `${symbol}${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Convert a display-currency amount back to INR for API calls. */
export function toINR(displayAmount: number, code: CurrencyCode): number {
  return displayAmount / CURRENCIES[code].rate;
}
