import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { CartHydrator } from '@/components/CartHydrator';
import { Analytics } from '@/components/Analytics';

export const metadata: Metadata = {
  title: 'Vrindaonline — Handcrafted jewelry marketplace',
  description: 'Discover handcrafted jewelry from independent vendors across India.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink-900 antialiased">
        <Analytics />
        <CartHydrator />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: '10px',
              background: '#1f2937',
              color: '#fff',
              fontSize: '14px',
              padding: '12px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
