'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useSupportNotifications, refreshUnread } from '@/lib/realtime/notifications';
import { enablePush, disablePush, getPushState, type PushState } from '@/lib/realtime/push';

const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';

// Bell with an unread badge + dropdown of recent support notifications, plus a
// browser-notifications (web push) toggle. `baseHref` is the per-app ticket link
// base (e.g. "/support"); `pathTemplate` is the deep link with {id} for push.
// Renders only for logged-in users (safe in headers shown to guests).
export function NotificationBell({ baseHref, pathTemplate }: { baseHref: string; pathTemplate: string }) {
  const { unread, items } = useSupportNotifications();
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState>('default');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuthed(typeof window !== 'undefined' && !!window.localStorage.getItem(TOKEN_KEY));
    getPushState().then(setPushState);
  }, []);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggleOpen() {
    setOpen((o) => { if (!o) refreshUnread(); return !o; });
  }

  async function onEnable() {
    setBusy(true);
    try {
      await enablePush(`${window.location.origin}${pathTemplate}`);
      setPushState('granted');
      toast.success('Browser notifications enabled');
    } catch (e: any) {
      toast.error(e?.message || 'Could not enable notifications');
      setPushState(await getPushState());
    } finally { setBusy(false); }
  }
  async function onDisable() {
    setBusy(true);
    try { await disablePush(); toast.success('Browser notifications turned off'); setPushState(await getPushState()); }
    finally { setBusy(false); }
  }

  if (!authed) return null;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggleOpen}
        className="relative h-9 w-9 rounded-md hover:bg-canvas flex items-center justify-center text-ink-700"
        aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-line rounded-md shadow-card z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-line">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            <Link href={baseHref} onClick={() => setOpen(false)} className="text-xs text-brand-700 hover:underline">Open support</Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-ink-500 px-4 py-6 text-center">No new notifications.</p>
            ) : (
              items.map((n, i) => (
                <Link key={`${n.ticketId}-${i}`} href={`${baseHref}/${n.ticketId}`} onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 hover:bg-canvas border-b border-line last:border-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{n.fromName} · {n.subject}</p>
                  <p className="text-xs text-ink-500 truncate">{n.preview}</p>
                </Link>
              ))
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-line">
            {pushState === 'unsupported' ? (
              <p className="text-xs text-ink-400">Browser notifications aren't supported here.</p>
            ) : pushState === 'granted' ? (
              <button onClick={onDisable} disabled={busy} className="text-xs text-ink-500 hover:text-danger disabled:opacity-50">
                Turn off browser notifications
              </button>
            ) : (
              <button onClick={onEnable} disabled={busy} className="text-xs text-brand-700 hover:underline disabled:opacity-50">
                {busy ? 'Enabling…' : '🔔 Enable browser notifications'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
