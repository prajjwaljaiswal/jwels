import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = `"Vrindaonline Marketplace" <${process.env.GMAIL_USER}>`;

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

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a1a;margin-bottom:8px">Reset your password</h2>
        <p style="color:#555;margin-bottom:24px">
          Click the button below to reset your password. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;background:#F1641E;color:#fff;text-decoration:none;
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
  await transporter.sendMail({
    from: FROM,
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
  const cta = data.storeUrl
    ? `<a href="${data.storeUrl}" style="display:inline-block;background:#F1641E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:8px">Complete your order</a>`
    : '';
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'You left something behind ✨',
    html: shell(
      'Still thinking it over?',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, you have ${data.itemCount} item${data.itemCount === 1 ? '' : 's'} waiting in your cart. Pieces like these sell fast — complete your order before they're gone.</p>${cta}`
    ),
  });
}

export async function sendOrderDeliveredEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Delivered — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your order was delivered',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, <strong>${escapeHtml(data.productName)}</strong> has been delivered. We hope you love it!</p>
       <p style="color:#555">If anything isn't right, you can request a return from your orders page within the return window.</p>`
    ),
  });
}

export async function sendRefundEmail(
  to: string,
  data: { orderId: string; customerName: string; productName: string; amountLabel: string; gateway: boolean }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Refund processed — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html: shell(
      'Your refund is on its way',
      `<p style="color:#555">Hi ${escapeHtml(data.customerName)}, we've processed a refund of <strong>${escapeHtml(data.amountLabel)}</strong> for <strong>${escapeHtml(data.productName)}</strong>.</p>
       <p style="color:#555">${data.gateway ? 'It will reflect in your original payment method within 5–7 business days.' : 'Our team will transfer it to you shortly.'}</p>`
    ),
  });
}

// ── Support module ────────────────────────────────────────────────────────

function supportBtn(link: string, label = 'View conversation'): string {
  return `<a href="${link}" style="display:inline-block;background:#F1641E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:8px">${escapeHtml(
    label
  )}</a>`;
}

// Sent to the requester when their ticket is created.
export async function sendSupportTicketReceivedEmail(
  to: string,
  data: { ticketNumber: string; subject: string; link: string }
) {
  await transporter.sendMail({
    from: FROM,
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
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `New reply on ${data.ticketNumber} — ${data.subject}`,
    html: shell(
      'You have a new message',
      `<p style="color:#555"><strong>${escapeHtml(data.fromName)}</strong> replied on <strong>${escapeHtml(
        data.ticketNumber
      )}</strong>:</p>
       <blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #F1641E;color:#444;background:#faf7f4">${escapeHtml(
         data.preview
       )}</blockquote>${supportBtn(data.link, 'Reply')}`
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
  const trackBtn = data.trackingUrl
    ? `<a href="${data.trackingUrl}" style="display:inline-block;background:#F1641E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:8px">Track your shipment</a>`
    : '';
  await transporter.sendMail({
    from: FROM,
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
