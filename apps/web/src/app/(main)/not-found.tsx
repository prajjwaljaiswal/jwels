import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-container mx-auto px-6 py-20 text-center">
      <p className="text-xs tracking-[0.18em] uppercase text-brand-700 font-semibold mb-3">404</p>
      <h1 className="font-display text-4xl md:text-5xl text-ink-900 mb-4">
        Nothing here
      </h1>
      <p className="text-ink-700 max-w-md mx-auto mb-6">
        The page you're looking for may have moved, or never existed.
      </p>
      <Link href="/" className="btn-primary">Back to the marketplace</Link>
    </div>
  );
}
