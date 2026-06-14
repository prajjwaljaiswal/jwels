// WhatsApp notifications via a pluggable provider (Gupshup / Interakt). India is
// WhatsApp-first, so order updates and abandoned-cart nudges convert far better
// here than email. Until a provider is configured the calls no-op (logged), so
// the rest of the app can wire WhatsApp now and enable it with env later.
//
// Configure with WHATSAPP_PROVIDER=gupshup|interakt plus the provider's API key.

const PROVIDER = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();

function configured(): boolean {
  if (PROVIDER === 'gupshup') return !!process.env.GUPSHUP_API_KEY && !!process.env.GUPSHUP_SOURCE;
  if (PROVIDER === 'interakt') return !!process.env.INTERAKT_API_KEY;
  return false;
}

/**
 * Send a plain-text WhatsApp message. Best-effort — never throws. Returns true
 * if the provider accepted it, false if not configured or it failed.
 */
export async function sendWhatsApp(toPhone: string, message: string): Promise<boolean> {
  const phone = (toPhone || '').replace(/[^\d]/g, '');
  if (!phone) return false;
  if (!configured()) {
    if (process.env.NODE_ENV !== 'production') console.log(`[whatsapp:dev] → ${phone}: ${message}`);
    return false;
  }
  try {
    if (PROVIDER === 'interakt') {
      await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: { Authorization: `Basic ${process.env.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: '+91', phoneNumber: phone.replace(/^91/, ''), type: 'Text', data: { message } }),
      });
    } else if (PROVIDER === 'gupshup') {
      const body = new URLSearchParams({
        channel: 'whatsapp',
        source: process.env.GUPSHUP_SOURCE!,
        destination: phone,
        message: JSON.stringify({ type: 'text', text: message }),
        'src.name': process.env.GUPSHUP_APP_NAME || 'Vrindaonline',
      });
      await fetch('https://api.gupshup.io/wa/api/v1/msg', {
        method: 'POST',
        headers: { apikey: process.env.GUPSHUP_API_KEY!, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    }
    return true;
  } catch (e: any) {
    console.warn('[whatsapp] send failed:', e?.message);
    return false;
  }
}
