'use client';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';

// Scope the socket connection to the support area only (the rest of the
// dashboard doesn't need a live socket).
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
