'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useMe } from '@/lib/permissions';
import { supportApi } from '@/lib/support/api';
import { STATUS_LABELS } from '@/lib/support/types';
import type { SupportTicketDTO, SupportMessageDTO } from '@/lib/support/types';
import { useTicketStream } from '@/lib/realtime/useTicketStream';

function isImage(url: string) {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|$)/i.test(url);
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export function SupportThread({ ticketId }: { ticketId: string }) {
  const { me } = useMe();
  const [ticket, setTicket] = useState<SupportTicketDTO | null>(null);
  const [messages, setMessages] = useState<SupportMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingPeer, setTypingPeer] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closed = ticket?.status === 'CLOSED';

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([supportApi.getTicket(ticketId), supportApi.getMessages(ticketId)])
      .then(([t, msgs]) => {
        if (cancelled) return;
        setTicket(t); setMessages(msgs); scrollToBottom();
        supportApi.markRead(ticketId).catch(() => {});
      })
      .catch((e) => { if (!cancelled) toast.error(e?.message || 'Could not load conversation'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const { connected, sendTyping } = useTicketStream(ticketId, {
    onMessage: (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      scrollToBottom();
      if (m.authorId !== me?.id) supportApi.markRead(ticketId).catch(() => {});
    },
    onTicketUpdate: (t) => setTicket(t),
    onRead: ({ side, readAt }) => {
      if (side === 'requester') return; // that's me
      setMessages((prev) => prev.map((m) => (m.authorId === me?.id && !m.readAt ? { ...m, readAt } : m)));
    },
    onTyping: ({ userId, isTyping }) => {
      if (userId === me?.id) return;
      setTypingPeer(isTyping);
      if (peerTimer.current) clearTimeout(peerTimer.current);
      if (isTyping) peerTimer.current = setTimeout(() => setTypingPeer(false), 4000);
    },
  });

  function onBodyChange(v: string) {
    setBody(v);
    sendTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sendTyping(false), 1500);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const { url, name } = await supportApi.uploadAttachment(file);
        setAttachments((prev) => [...prev, { url, name }]);
      }
    } catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function onSend() {
    const text = body.trim();
    if (!text && attachments.length === 0) return;
    setSending(true);
    sendTyping(false);
    try {
      const msg = await supportApi.sendMessage(ticketId, { body: text || '(attachment)', attachments: attachments.map((a) => a.url) });
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setBody(''); setAttachments([]); scrollToBottom();
    } catch (e: any) { toast.error(e?.message || 'Could not send message'); }
    finally { setSending(false); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); }
  }

  const visible = messages.filter((m) => !m.isInternalNote);

  return (
    <div className="flex flex-col rounded-md bg-surface border border-line shadow-card">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900 truncate">{ticket?.subject || 'Conversation'}</p>
          <p className="text-xs text-ink-500">
            {ticket?.ticketNumber}{ticket?.vendorName ? ` · ${ticket.vendorName}` : ticket ? ' · Vrindaonline Support' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-ink-300'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          {ticket && <span className="rounded-pill bg-canvas border border-line px-2.5 py-0.5 text-[11px] font-semibold text-ink-700">{STATUS_LABELS[ticket.status]}</span>}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[300px] max-h-[60vh]">
        {loading ? (
          <p className="text-sm text-ink-500">Loading conversation…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-ink-500">No messages yet.</p>
        ) : (
          visible.map((m) => {
            const mine = m.authorId === me?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-canvas border border-line text-ink-900'}`}>
                  {!mine && (
                    <p className="text-[11px] font-semibold mb-0.5 text-ink-500">
                      {m.authorName}{m.authorRole === 'ADMIN' ? ' · Support' : m.authorRole === 'VENDOR' ? ' · Seller' : ''}
                    </p>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.attachments?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((url) => isImage(url) ? (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="attachment" className="h-20 w-20 object-cover rounded border border-line" />
                        </a>
                      ) : (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className={`text-xs underline ${mine ? 'text-white' : 'text-brand-700'}`}>📎 Attachment</a>
                      ))}
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-ink-400'}`}>
                    {fmtTime(m.createdAt)}{mine ? (m.readAt ? ' · Read' : ' · Sent') : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {typingPeer && <p className="text-xs text-ink-500 italic">typing…</p>}
      </div>

      <div className="border-t border-line p-3">
        {closed ? (
          <p className="text-sm text-ink-500 text-center py-2">This conversation is closed. Start a new request if you still need help.</p>
        ) : (
          <>
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <span key={a.url} className="inline-flex items-center gap-1 text-xs bg-canvas border border-line rounded px-2 py-1">
                    📎 {a.name?.slice(0, 18) || 'file'}
                    <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-ink-400 hover:text-danger">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="h-10 w-10 shrink-0 rounded-md border border-line hover:bg-canvas flex items-center justify-center text-ink-600 disabled:opacity-50" title="Attach image or PDF">
                {uploading ? '…' : '📎'}
              </button>
              <textarea value={body} onChange={(e) => onBodyChange(e.target.value)} onKeyDown={onKeyDown} rows={2}
                placeholder="Write a message…  (⌘/Ctrl + Enter to send)"
                className="flex-1 resize-none rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
              <button type="button" onClick={onSend} disabled={sending || (!body.trim() && attachments.length === 0)}
                className="h-10 px-4 shrink-0 rounded-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
