'use client';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
