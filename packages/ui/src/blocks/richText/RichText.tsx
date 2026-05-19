'use client';
import DOMPurify from 'isomorphic-dompurify';

export interface RichTextSettings {
  html: string;
  maxWidth: 'narrow' | 'medium' | 'wide';
  align: 'left' | 'center';
}

const widthClass: Record<RichTextSettings['maxWidth'], string> = {
  narrow: 'max-w-2xl',
  medium: 'max-w-3xl',
  wide: 'max-w-5xl',
};

export function RichTextRenderer({ settings: s }: { settings: RichTextSettings }) {
  const safe = DOMPurify.sanitize(s.html ?? '', {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'hr', 'img', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'],
  });
  return (
    <section className={`px-6 sm:px-10 py-8 ${s.align === 'center' ? 'text-center' : ''}`}>
      <div
        className={`prose prose-ink ${widthClass[s.maxWidth]} ${s.align === 'center' ? 'mx-auto' : ''}`}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </section>
  );
}

export function defaultRichText(): RichTextSettings {
  return {
    html: '<h2>About our shop</h2><p>Tell your story here. What inspires you, where you source your materials, what makes your pieces special.</p>',
    maxWidth: 'medium',
    align: 'left',
  };
}
