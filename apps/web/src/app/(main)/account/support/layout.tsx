'use client';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';

// Socket connects only within the support area (logged-in customers).
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
