import Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * Platform-level Razorpay client — fallback for orders that don't have a vendor
 * payment method attached (e.g. legacy orders predating per-vendor methods).
 */
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export function razorpayClient(creds: { keyId: string; keySecret: string }) {
  return new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
}

/**
 * Verify the signature returned by Razorpay checkout.
 * Pass `secret` to verify against a vendor-specific key_secret; otherwise the
 * platform RAZORPAY_KEY_SECRET env var is used.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret?: string;
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
  const secret = params.secret ?? process.env.RAZORPAY_KEY_SECRET ?? '';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return expected === razorpaySignature;
}

/**
 * Verify a Razorpay webhook signature: HMAC-SHA256 over the RAW request body
 * keyed by the webhook secret (RAZORPAY_WEBHOOK_SECRET). Uses a timing-safe
 * comparison.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string, secret?: string): boolean {
  const key = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
  if (!key || !signature) return false;
  const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
