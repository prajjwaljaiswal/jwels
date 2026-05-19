// Required by a known Next.js / Vercel route-group manifest bug:
// adding loading.tsx alongside a (group)/page.tsx forces emission of
// `page_client-reference-manifest.js` and prevents the Vercel deploy
// ENOENT (vercel/next.js#58272).
export default function Loading() {
  return (
    <div className="max-w-container mx-auto px-6 py-20 text-center text-ink-500">
      Loading…
    </div>
  );
}
