// Cross-origin login handoff to the vendor dashboard.
//
// The JWT lives in THIS app's localStorage (the marketing/onboarding origin —
// localhost:3000 / vrindaonline.com). The vendor dashboard is a DIFFERENT origin
// (localhost:3001 / vendor.vrindaonline.com), so it can't read that localStorage.
//
// We send the token to the vendor app's /auth/handoff page in the URL HASH (`#token=…`).
// A hash fragment is never sent to the server (so it won't appear in access logs), and the
// handoff page strips it immediately after storing the token, then loads the dashboard —
// which signs the seller in automatically via the shared backend JWT.

const VENDOR_URL = process.env.NEXT_PUBLIC_VENDOR_URL || 'http://localhost:3001';

/** Build the vendor-dashboard handoff URL carrying the current JWT (if any). */
export function vendorHandoffUrl(next = '/'): string {
  const base = VENDOR_URL.replace(/\/+$/, '');
  if (typeof window === 'undefined') return base;
  const token = window.localStorage.getItem('token') || '';
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (next) params.set('next', next);
  return `${base}/auth/handoff#${params.toString()}`;
}

/** Navigate to the vendor dashboard, carrying the seller's session across origins. */
export function goToVendorDashboard(next = '/'): void {
  if (typeof window !== 'undefined') window.location.href = vendorHandoffUrl(next);
}
