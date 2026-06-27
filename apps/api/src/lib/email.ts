import Mailgun from 'mailgun.js';
import formData from 'form-data';

// ── Mailgun transport ─────────────────────────────────────────────────────────
// Every transactional email funnels through `sendMail`. Configuration is entirely
// env-driven:
//   MAILGUN_API_KEY — private API key (required to actually send)
//   MAILGUN_DOMAIN  — sending domain (sandbox or a verified domain)
//   MAILGUN_FROM    — From header, e.g. "Vrindaonline <postmaster@your-domain>"
//   MAILGUN_URL     — optional; set to https://api.eu.mailgun.net for EU domains
//
// When the key/domain are unset we no-op (warn once per message) instead of
// throwing, so local dev, CI and tests don't crash on a missing integration.
// This mirrors the best-effort posture every caller already assumes — none of
// them should fail a request because an email couldn't be sent.

type MailgunClient = ReturnType<Mailgun['client']>;

let _client: MailgunClient | null | undefined;
let _warnedMissing = false;

function getClient(): MailgunClient | null {
  if (_client !== undefined) return _client;
  const key = process.env.MAILGUN_API_KEY;
  if (!key) {
    _client = null;
    return _client;
  }
  const mailgun = new Mailgun(formData);
  _client = mailgun.client({
    username: 'api',
    key,
    // EU-region domains require the EU endpoint; leave unset for US/global.
    ...(process.env.MAILGUN_URL ? { url: process.env.MAILGUN_URL } : {}),
  });
  return _client;
}

const FROM =
  process.env.MAILGUN_FROM ||
  `Vrindaonline Marketplace <postmaster@${process.env.MAILGUN_DOMAIN || 'localhost'}>`;

/**
 * Low-level send. Resolves quietly (without sending) when Mailgun isn't
 * configured so callers never have to special-case the unconfigured environment.
 */
async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const client = getClient();
  const domain = process.env.MAILGUN_DOMAIN;
  if (!client || !domain) {
    if (!_warnedMissing) {
      console.warn('[email] Mailgun is not configured (set MAILGUN_API_KEY + MAILGUN_DOMAIN) — emails are being skipped.');
      _warnedMissing = true;
    }
    return;
  }
  await client.messages.create(domain, {
    from: FROM,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    // A plain-text part improves deliverability; derive a rough one when absent.
    text: opts.text ?? htmlToText(opts.html),
  });
}

// ── Presentation helpers ───────────────────────────────────────────────────────

const BRAND = '#F1641E';

// Wraps body content in a consistent branded shell.
function shell(title: string, bodyHtml: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin:0 0 8px">${title}</h2>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px" />
      <p style="color:#bbb;font-size:11px;margin:0">Vrindaonline Marketplace</p>
    </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:8px">${escapeHtml(
    label
  )}</a>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

// Crude HTML→text fallback for the plain-text MIME part.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Front-end origins used to build CTA links.
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';
const VENDOR_ORIGIN = process.env.VENDOR_ORIGIN || 'http://localhost:3001';

// ── Auth ────────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  await sendMail({
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a1a;margin-bottom:8px">Reset your password</h2>
        <p style="color:#555;margin-bottom:24px">
          Click the button below to reset your password. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
          Reset Password
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="color:#ccc;font-size:11px">
          Or copy this link: ${resetLink}
        </p>
      </div>
    `,
  });
}

/**
 * Welcome / account-created email. Copy adapts to the new account's role:
 * customers get a "start shopping" nudge, vendors a "finish onboarding" nudge.
 */
export async function sendWelcomeEmail(
  to: string,
  data: { name: string; role: 'CUSTOMER' | 'VENDOR' }
) {
  const isVendor = data.role === 'VENDOR';
  const cta = isVendor
    ? button(`${VENDOR_ORIGIN}/onboard`, 'Complete your shop setup')
    : button(WEB_ORIGIN, 'Start shopping');
  const intro = isVendor
    ? `Welcome aboard! Your seller account is ready. The next step is to complete your shop profile and KYC so we can review and approve your store.`
    : `Welcome to Vrindaonline! Your account is ready. Discover handpicked jewellery from sellers across India.`;
  await sendMail({
    to,
    subject: isVendor ? 'Welcome to Vrindaonline — let’s set up your shop' : 'Welcome to Vrindaonline ✨',
    html: shell(
      `Welcome, ${escapeHtml(data.name || 'there')}!`,
      `<p style="color:#555">${intro}</p>${cta}`
    ),
  });
}

// ── Orders (customer-facing) ──────────────────────────────────────────────────

export interface OrderEmailItem {
  name: string;
  quantity: number;
  priceLabel: string; // pre-formatted, e.g. "₹12,499"
}

export async function sendOrderConfirmationEmail(
  to: string,
  data: { orderId: string; customerName: string; totalLabel: string; items: OrderEmailItem[]; shopName?: string }
) {
  const rows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#444">${escapeHtml(i.name)} × ${i.quantity}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#444">${escapeHtml(i.priceLabel)}</td></tr>`
    )
    .join('');
  await sendMail({
    to,
    subject: `Order confirmed — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Thank you for your order!',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, we've received your order${
        data.shopName ? ` from <strong>${escapeHtml(data.shopName)}</strong>` : ''
      }. Here's a summary:</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
         <tr><td style="padding:10px 0 0;border-top:1px solid #eee;font-weight:700">Total</td>
             <td style="padding:10px 0 0;border-top:1px solid #eee;text-align:right;font-weight:700">${escapeHtml(
               data.totalLabel
             )}</td></tr>
       </table>
       <p style="color:#555">We'll email you again as soon as your order ships.</p>`
    ),
  });
}

export async function sendAbandonedCartEmail(
  to: string,
  data: { customerName: string; itemCount: number; storeUrl?: string }
) {
  const cta = data.storeUrl ? button(data.storeUrl, 'Complete your order') : '';
  await sendMail({
    to,
    subject: 'You left something behind ✨',
    html: shell(
      'Still thinking it over?',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, you have ${data.itemCount} item${data.itemCount === 1 ? '' : 's'} waiting in your cart. Pieces like these sell fast — complete your order before they're gone.</p>${cta}`
    ),
  });
}

export async function sendOrderShippedEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string; carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null }
) {
  const trackingLine = data.trackingNumber
    ? `<p style="color:#555">Tracking${data.carrier ? ` (${escapeHtml(data.carrier)})` : ''}: <strong>${escapeHtml(
        data.trackingNumber
      )}</strong></p>`
    : '';
  const trackBtn = data.trackingUrl ? button(data.trackingUrl, 'Track your shipment') : '';
  await sendMail({
    to,
    subject: `Your order has shipped — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your order is on its way!',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, <strong>${escapeHtml(
        data.productName
      )}</strong> from your order has been dispatched.</p>${trackingLine}${trackBtn}`
    ),
  });
}

export async function sendOrderDeliveredEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string }
) {
  await sendMail({
    to,
    subject: `Delivered — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your order was delivered',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, <strong>${escapeHtml(data.productName)}</strong> has been delivered. We hope you love it!</p>
       <p style="color:#555">If anything isn't right, you can request a return from your orders page within the return window.</p>`
    ),
  });
}

export async function sendOrderCancelledEmail(
  to: string,
  data: { orderId: string; customerName: string }
) {
  await sendMail({
    to,
    subject: `Order cancelled — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your order was cancelled',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, your order <strong>#${data.orderId
        .slice(0, 8)
        .toUpperCase()}</strong> has been cancelled. If a payment was captured, any refund due will be processed automatically.</p>`
    ),
  });
}

export async function sendRefundEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string; amountLabel: string; gateway: boolean }
) {
  await sendMail({
    to,
    subject: `Refund processed — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your refund is on its way',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, we've processed a refund of <strong>${escapeHtml(data.amountLabel)}</strong> for <strong>${escapeHtml(data.productName)}</strong>.</p>
       <p style="color:#555">${data.gateway ? 'It will reflect in your original payment method within 5–7 business days.' : 'Our team will transfer it to you shortly.'}</p>`
    ),
  });
}

// ── Vendor lifecycle ──────────────────────────────────────────────────────────

/** Sent to the vendor when an order containing their item(s) is paid. */
export async function sendNewOrderVendorEmail(
  to: string,
  data: { orderId: string; shopName: string; items: OrderEmailItem[]; subtotalLabel: string; customerCity?: string | null }
) {
  const rows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#444">${escapeHtml(i.name)} × ${i.quantity}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#444">${escapeHtml(i.priceLabel)}</td></tr>`
    )
    .join('');
  await sendMail({
    to,
    subject: `New order received — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'You have a new order! 🎉',
      `<p style="color:#555">Great news for <strong>${escapeHtml(
        data.shopName
      )}</strong> — you've received a new paid order${
        data.customerCity ? ` shipping to ${escapeHtml(data.customerCity)}` : ''
      }. Please prepare it for dispatch.</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
         <tr><td style="padding:10px 0 0;border-top:1px solid #eee;font-weight:700">Your subtotal</td>
             <td style="padding:10px 0 0;border-top:1px solid #eee;text-align:right;font-weight:700">${escapeHtml(
               data.subtotalLabel
             )}</td></tr>
       </table>
       ${button(`${VENDOR_ORIGIN}/orders`, 'Manage this order')}`
    ),
  });
}

/** Sent to the vendor right after they submit their onboarding / KYC for review. */
export async function sendVendorOnboardingSubmittedEmail(
  to: string,
  data: { shopName: string; contactName?: string }
) {
  await sendMail({
    to,
    subject: 'We’ve received your shop application',
    html: shell(
      'Application received — under review',
      `<p style="color:#555">Hi ${escapeHtml(
        data.contactName || 'there'
      )}, thanks for submitting <strong>${escapeHtml(
        data.shopName
      )}</strong> for review. Our team is verifying your KYC details and will get back to you shortly — usually within 1–2 business days.</p>
       ${button(`${VENDOR_ORIGIN}/onboard`, 'View application status')}`
    ),
  });
}

/** Sent when an admin approves the vendor's shop. */
export async function sendVendorApprovedEmail(
  to: string,
  data: { shopName: string; contactName?: string; storeUrl?: string }
) {
  const visit = data.storeUrl ? button(data.storeUrl, 'View your storefront') : button(`${VENDOR_ORIGIN}`, 'Go to your dashboard');
  await sendMail({
    to,
    subject: `🎉 ${data.shopName} is now live on Vrindaonline`,
    html: shell(
      'Your shop has been approved!',
      `<p style="color:#555">Congratulations ${escapeHtml(
        data.contactName || ''
      )}! <strong>${escapeHtml(
        data.shopName
      )}</strong> has been approved and is now live. You can start listing products and receiving orders right away.</p>
       ${visit}`
    ),
  });
}

/** Sent when an admin rejects the vendor's shop. */
export async function sendVendorRejectedEmail(
  to: string,
  data: { shopName: string; contactName?: string; reason?: string | null }
) {
  await sendMail({
    to,
    subject: `Update on your ${data.shopName} application`,
    html: shell(
      'Your shop application needs attention',
      `<p style="color:#555">Hi ${escapeHtml(
        data.contactName || 'there'
      )}, we were unable to approve <strong>${escapeHtml(data.shopName)}</strong> at this time.</p>
       ${data.reason ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid ${BRAND};color:#444;background:#faf7f4">${escapeHtml(data.reason)}</blockquote>` : ''}
       <p style="color:#555">You can update your details and re-submit for review.</p>
       ${button(`${VENDOR_ORIGIN}/onboard`, 'Update and re-submit')}`
    ),
  });
}

/** Sent when an admin suspends an approved shop. */
export async function sendVendorSuspendedEmail(
  to: string,
  data: { shopName: string; contactName?: string }
) {
  await sendMail({
    to,
    subject: `Your shop ${data.shopName} has been suspended`,
    html: shell(
      'Your shop has been suspended',
      `<p style="color:#555">Hi ${escapeHtml(
        data.contactName || 'there'
      )}, <strong>${escapeHtml(
        data.shopName
      )}</strong> has been temporarily suspended and is no longer visible to customers. Please contact support to resolve this.</p>`
    ),
  });
}

/** Sent when KYC verification succeeds. */
export async function sendKycApprovedEmail(
  to: string,
  data: { shopName: string; contactName?: string }
) {
  await sendMail({
    to,
    subject: 'Your KYC has been verified ✅',
    html: shell(
      'KYC verified',
      `<p style="color:#555">Hi ${escapeHtml(
        data.contactName || 'there'
      )}, the KYC details for <strong>${escapeHtml(
        data.shopName
      )}</strong> have been verified. Your account is fully set up for payouts.</p>
       ${button(`${VENDOR_ORIGIN}`, 'Go to your dashboard')}`
    ),
  });
}

/** Sent when KYC verification is rejected. */
export async function sendKycRejectedEmail(
  to: string,
  data: { shopName: string; contactName?: string; note?: string | null }
) {
  await sendMail({
    to,
    subject: 'Action needed: your KYC could not be verified',
    html: shell(
      'KYC needs another look',
      `<p style="color:#555">Hi ${escapeHtml(
        data.contactName || 'there'
      )}, we couldn't verify the KYC details for <strong>${escapeHtml(data.shopName)}</strong>.</p>
       ${data.note ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid ${BRAND};color:#444;background:#faf7f4">${escapeHtml(data.note)}</blockquote>` : ''}
       <p style="color:#555">Please review your documents and re-submit.</p>
       ${button(`${VENDOR_ORIGIN}/onboard`, 'Update KYC details')}`
    ),
  });
}

/** Sent when a payout to the vendor is marked paid. */
export async function sendPayoutPaidEmail(
  to: string,
  data: { shopName: string; contactName?: string; amountLabel: string; utr?: string | null; itemCount?: number }
) {
  await sendMail({
    to,
    subject: `Payout sent — ${data.amountLabel}`,
    html: shell(
      'Your payout is on the way',
      `<p style="color:#555">Hi ${escapeHtml(
        data.contactName || 'there'
      )}, a payout of <strong>${escapeHtml(data.amountLabel)}</strong> for <strong>${escapeHtml(
        data.shopName
      )}</strong>${
        data.itemCount ? ` (covering ${data.itemCount} item${data.itemCount === 1 ? '' : 's'})` : ''
      } has been processed.</p>
       ${data.utr ? `<p style="color:#555">Bank reference (UTR): <strong>${escapeHtml(data.utr)}</strong></p>` : ''}
       ${button(`${VENDOR_ORIGIN}/payouts`, 'View payout details')}`
    ),
  });
}

// ── Product moderation (vendor-facing) ─────────────────────────────────────────

export async function sendProductApprovedEmail(
  to: string,
  data: { shopName: string; productName: string }
) {
  await sendMail({
    to,
    subject: `Your product is live — ${data.productName}`,
    html: shell(
      'Product approved',
      `<p style="color:#555"><strong>${escapeHtml(
        data.productName
      )}</strong> has been approved and is now live on your store, <strong>${escapeHtml(
        data.shopName
      )}</strong>.</p>
       ${button(`${VENDOR_ORIGIN}/products`, 'View your products')}`
    ),
  });
}

export async function sendProductRejectedEmail(
  to: string,
  data: { shopName: string; productName: string; note?: string | null }
) {
  await sendMail({
    to,
    subject: `Your product needs changes — ${data.productName}`,
    html: shell(
      'Product not approved',
      `<p style="color:#555"><strong>${escapeHtml(
        data.productName
      )}</strong> was not approved for listing on <strong>${escapeHtml(data.shopName)}</strong>.</p>
       ${data.note ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid ${BRAND};color:#444;background:#faf7f4">${escapeHtml(data.note)}</blockquote>` : ''}
       <p style="color:#555">Please update the listing and re-submit it for review.</p>
       ${button(`${VENDOR_ORIGIN}/products`, 'Edit product')}`
    ),
  });
}

// ── Returns (customer-facing) ──────────────────────────────────────────────────

export async function sendReturnRequestedEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string; reason?: string | null }
) {
  await sendMail({
    to,
    subject: `Return request received — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'We’ve received your return request',
      `<p style="color:#555">Hi ${escapeHtml(
        data.customerName
      )}, we've logged your return request for <strong>${escapeHtml(
        data.productName
      )}</strong>. The seller will review it shortly and we'll email you with the next steps.</p>
       ${data.reason ? `<p style="color:#888">Reason: ${escapeHtml(data.reason)}</p>` : ''}`
    ),
  });
}

export async function sendReturnApprovedEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string; instructions?: string }
) {
  await sendMail({
    to,
    subject: `Return approved — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your return was approved',
      `<p style="color:#555">Hi ${escapeHtml(
        data.customerName
      )}, your return for <strong>${escapeHtml(data.productName)}</strong> has been approved.</p>
       <p style="color:#555">${escapeHtml(
         data.instructions ||
           'Please keep the item in its original packaging — we’ll be in touch to arrange the pickup or drop-off. Your refund follows once the item is received.'
       )}</p>`
    ),
  });
}

export async function sendReturnRejectedEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string; reason?: string | null }
) {
  await sendMail({
    to,
    subject: `Update on your return — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your return request was declined',
      `<p style="color:#555">Hi ${escapeHtml(
        data.customerName
      )}, after review, your return request for <strong>${escapeHtml(
        data.productName
      )}</strong> could not be approved.</p>
       ${data.reason ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid ${BRAND};color:#444;background:#faf7f4">${escapeHtml(data.reason)}</blockquote>` : ''}
       <p style="color:#555">If you believe this is a mistake, you can raise a dispute from your orders page.</p>`
    ),
  });
}

// ── Auth (security notice) ─────────────────────────────────────────────────────

export async function sendPasswordResetConfirmationEmail(to: string, data: { name: string }) {
  await sendMail({
    to,
    subject: 'Your password was changed',
    html: shell(
      'Your password was changed',
      `<p style="color:#555">Hi ${escapeHtml(
        data.name || 'there'
      )}, this is a confirmation that your Vrindaonline password was just changed.</p>
       <p style="color:#555">If you did <strong>not</strong> make this change, reset your password again immediately and contact support.</p>`
    ),
  });
}

// ── Engagement (reviews & questions) ───────────────────────────────────────────

export async function sendReviewSubmittedEmail(
  to: string,
  data: { shopName: string; productName: string; rating: number; reviewerName?: string }
) {
  const r = Math.max(0, Math.min(5, Math.round(data.rating)));
  const stars = '★'.repeat(r) + '☆'.repeat(5 - r);
  await sendMail({
    to,
    subject: `New ${r}-star review on ${data.productName}`,
    html: shell(
      'You have a new review',
      `<p style="color:#555"><strong>${escapeHtml(
        data.reviewerName || 'A customer'
      )}</strong> reviewed <strong>${escapeHtml(data.productName)}</strong> at ${escapeHtml(
        data.shopName
      )}.</p>
       <p style="font-size:20px;color:${BRAND};margin:8px 0">${stars}</p>
       ${button(`${VENDOR_ORIGIN}/reviews`, 'View & respond')}`
    ),
  });
}

export async function sendQuestionAnsweredEmail(
  to: string,
  data: { customerName: string; productName: string; question: string; answer: string; productUrl?: string }
) {
  await sendMail({
    to,
    subject: `Your question about ${data.productName} was answered`,
    html: shell(
      'Your question has an answer',
      `<p style="color:#555">Hi ${escapeHtml(
        data.customerName
      )}, the seller answered your question about <strong>${escapeHtml(data.productName)}</strong>.</p>
       <p style="color:#888;margin:12px 0 2px"><strong>Q:</strong> ${escapeHtml(data.question)}</p>
       <blockquote style="margin:4px 0 12px;padding:10px 14px;border-left:3px solid ${BRAND};color:#444;background:#faf7f4"><strong>A:</strong> ${escapeHtml(
         data.answer
       )}</blockquote>
       ${data.productUrl ? button(data.productUrl, 'View product') : ''}`
    ),
  });
}

// ── Support module ────────────────────────────────────────────────────────────

function supportBtn(link: string, label = 'View conversation'): string {
  return button(link, label);
}

// Sent to the requester when their ticket is created.
export async function sendSupportTicketReceivedEmail(
  to: string,
  data: { ticketNumber: string; subject: string; link: string }
) {
  await sendMail({
    to,
    subject: `We've received your request — ${data.ticketNumber}`,
    html: shell(
      'Your support request is open',
      `<p style="color:#555">Thanks for reaching out. Your request <strong>${escapeHtml(
        data.ticketNumber
      )}</strong> — “${escapeHtml(
        data.subject
      )}” — has been logged and our team will reply here shortly.</p>${supportBtn(data.link)}`
    ),
  });
}

// Sent to the counterpart when a new (non-internal) message lands on a ticket.
export async function sendSupportMessageEmail(
  to: string,
  data: { ticketNumber: string; subject: string; fromName: string; preview: string; link: string }
) {
  await sendMail({
    to,
    subject: `New reply on ${data.ticketNumber} — ${data.subject}`,
    html: shell(
      'You have a new message',
      `<p style="color:#555"><strong>${escapeHtml(data.fromName)}</strong> replied on <strong>${escapeHtml(
        data.ticketNumber
      )}</strong>:</p>
       <blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid ${BRAND};color:#444;background:#faf7f4">${escapeHtml(
         data.preview
       )}</blockquote>${supportBtn(data.link, 'Reply')}`
    ),
  });
}
