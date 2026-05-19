'use client';

export interface TestimonialItem {
  quote: string;
  author: string;
  avatarUrl?: string;
  rating?: number;
}
export interface TestimonialsSettings {
  heading: string;
  items: TestimonialItem[];
}

export function TestimonialsRenderer({ settings: s }: { settings: TestimonialsSettings }) {
  if (!s.items.length) {
    return (
      <section className="px-6 sm:px-10 py-10">
        <p className="text-sm text-ink-500 italic">No testimonials yet.</p>
      </section>
    );
  }
  return (
    <section className="px-6 sm:px-10 py-12 bg-canvas">
      {s.heading && <h2 className="text-2xl font-semibold mb-8 text-center">{s.heading}</h2>}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {s.items.map((t, i) => (
          <figure key={i} className="bg-white border border-line rounded-lg p-6">
            {t.rating ? (
              <div className="text-amber-500 text-sm mb-2">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</div>
            ) : null}
            <blockquote className="text-ink-800 italic">“{t.quote}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {t.avatarUrl && <img src={t.avatarUrl} alt={t.author} className="w-9 h-9 rounded-full object-cover" />}
              <span className="text-sm font-medium">{t.author}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function defaultTestimonials(): TestimonialsSettings {
  return {
    heading: 'What our customers say',
    items: [
      { quote: 'Beautiful piece, even better in person. Will buy again.', author: 'Priya S.', rating: 5 },
    ],
  };
}
