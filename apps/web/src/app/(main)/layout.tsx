import { Header } from '@/components/storefront/Header';
import { Footer } from '@/components/storefront/Footer';
import { NotificationsProvider } from '@/lib/realtime/NotificationsProvider';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
      <Header />
      <main>{children}</main>
      <Footer />
    </NotificationsProvider>
  );
}
