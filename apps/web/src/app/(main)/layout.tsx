import { Header } from '@/components/storefront/Header';
import { Footer } from '@/components/storefront/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
