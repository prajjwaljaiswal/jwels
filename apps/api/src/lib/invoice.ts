import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

// GST e-invoicing. Builds a compliant tax-invoice record from a paid order and
// renders a PDF on demand. Identity values (platform legal name + GSTIN) come
// from admin-configurable Settings; the seller GSTIN/state come from the vendor.
//
// Tax model: each line is taxed at the product's gstRatePercent (default 3% for
// jewellery, HSN 7113). Intra-state supply → CGST+SGST (split evenly);
// inter-state → IGST. The precise gold-3% + making-5% split lands with M2.1
// (live gold-rate pricing) once price is decomposed into metal + making value.
// IRN/QR (mandatory only above the e-invoicing turnover threshold) are
// placeholders here and can be populated via an e-invoice provider later.

function norm(s?: string | null): string {
  return (s ?? '').trim().toLowerCase();
}

function financialYear(d: Date): string {
  const y = d.getFullYear();
  // Indian FY runs Apr–Mar.
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

async function nextInvoiceNumber(now: Date): Promise<string> {
  const fy = financialYear(now);
  const key = `invoice_counter_${fy}`;
  const next = await prisma.$transaction(async (tx) => {
    const s = await tx.setting.findUnique({ where: { key } });
    const n = (s ? parseInt(s.value, 10) || 0 : 0) + 1;
    await tx.setting.upsert({ where: { key }, create: { key, value: String(n) }, update: { value: String(n) } });
    return n;
  });
  return `INV/${fy}/${String(next).padStart(5, '0')}`;
}

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

export interface InvoiceLine {
  name: string;
  hsn: string;
  qty: number;
  unitPrice: number;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/**
 * Create (or return the existing) invoice for an order. Idempotent — safe to
 * call from the verify, webhook, and COD paths.
 */
export async function createInvoiceForOrder(orderId: string, now: Date = new Date()) {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, hsnCode: true, gstRatePercent: true } },
          vendor: { select: { shopName: true, legalName: true, gstin: true, address: true, pickupAddress: { select: { state: true } } } },
        },
      },
    },
  });
  if (!order) return null;

  const shippingAddr = (order.shippingAddress ?? {}) as { name?: string; state?: string };
  const buyerState = shippingAddr.state ?? '';
  const vendor = order.items[0]?.vendor;
  const sellerState = vendor?.pickupAddress?.state ?? '';
  // If we cannot determine the seller's state, default to intra-state (CGST+SGST).
  const isInterState = !!sellerState && !!buyerState && norm(sellerState) !== norm(buyerState);

  // Distribute the order-level discount proportionally across line taxable values.
  const goodsTotal = order.items.reduce((s, it) => s + Number(it.priceAtPurchase) * it.quantity, 0);
  const discount = Number(order.discountAmount);

  let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
  const lines: InvoiceLine[] = order.items.map((it) => {
    const lineGross = Number(it.priceAtPurchase) * it.quantity;
    const lineDiscount = goodsTotal > 0 ? (discount * lineGross) / goodsTotal : 0;
    const taxable = Math.max(0, lineGross - lineDiscount);
    const rate = Number(it.product?.gstRatePercent ?? 3);
    const taxAmt = (taxable * rate) / 100;
    const cgst = isInterState ? 0 : taxAmt / 2;
    const sgst = isInterState ? 0 : taxAmt / 2;
    const igst = isInterState ? taxAmt : 0;
    subtotal += taxable;
    cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst;
    return {
      name: it.product?.name ?? 'Item',
      hsn: it.product?.hsnCode ?? '7113',
      qty: it.quantity,
      unitPrice: Number(it.priceAtPurchase),
      taxableValue: round2(taxable),
      gstRate: rate,
      cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst),
      total: round2(taxable + taxAmt),
    };
  });

  const shippingTotal = Number(order.shippingTotal);
  const grandTotal = round2(subtotal + cgstTotal + sgstTotal + igstTotal + shippingTotal);

  const [platformName, platformGstin] = await Promise.all([
    getSetting('platform_legal_name'),
    getSetting('platform_gstin'),
  ]);

  try {
    return await prisma.invoice.create({
      data: {
        orderId: order.id,
        invoiceNumber: await nextInvoiceNumber(now),
        sellerName: vendor?.legalName ?? vendor?.shopName ?? null,
        sellerGstin: vendor?.gstin ?? null,
        sellerAddress: vendor?.address ?? null,
        platformName: platformName ?? 'Vrindaonline Marketplace',
        platformGstin: platformGstin ?? null,
        buyerName: shippingAddr.name ?? order.customer?.name ?? 'Customer',
        buyerState: buyerState || null,
        placeOfSupply: buyerState || null,
        isInterState,
        subtotal: round2(subtotal),
        cgst: round2(cgstTotal),
        sgst: round2(sgstTotal),
        igst: round2(igstTotal),
        shippingTotal: round2(shippingTotal),
        discountTotal: round2(discount),
        grandTotal,
        lineItems: lines as any,
      },
    });
  } catch (e: any) {
    // Unique-constraint race (invoiceNumber or orderId): another path created it.
    if (e?.code === 'P2002') return prisma.invoice.findUnique({ where: { orderId } });
    throw e;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function inr(n: number | string | Prisma.Decimal): string {
  return `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type InvoiceRecord = NonNullable<Awaited<ReturnType<typeof createInvoiceForOrder>>>;

/** Render the invoice as a PDF buffer (streamed at download time). */
export function generateInvoicePdf(inv: InvoiceRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const lines = (inv.lineItems as unknown as InvoiceLine[]) ?? [];

    doc.fontSize(18).text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#666')
      .text(`Invoice No: ${inv.invoiceNumber}`, { align: 'center' })
      .text(`Date: ${new Date(inv.createdAt).toLocaleDateString('en-IN')}`, { align: 'center' });
    doc.moveDown(1).fillColor('#000');

    doc.fontSize(11).text('Sold by', { continued: false });
    doc.fontSize(9).fillColor('#333')
      .text(inv.sellerName ?? '—')
      .text(inv.sellerGstin ? `GSTIN: ${inv.sellerGstin}` : 'GSTIN: —')
      .text(inv.sellerAddress ?? '');
    doc.moveDown(0.5).fillColor('#000');

    doc.fontSize(11).text('Billed to');
    doc.fontSize(9).fillColor('#333')
      .text(inv.buyerName)
      .text(`Place of supply: ${inv.placeOfSupply ?? '—'}`);
    doc.moveDown(1).fillColor('#000');

    // Line items table
    const tax = inv.isInterState ? 'IGST' : 'CGST+SGST';
    doc.fontSize(9).fillColor('#000');
    doc.text('Item', 48, doc.y, { continued: true, width: 200 });
    doc.text('HSN', { continued: true, width: 50 });
    doc.text('Qty', { continued: true, width: 35 });
    doc.text('Taxable', { continued: true, width: 75 });
    doc.text(`${tax}`, { continued: true, width: 75 });
    doc.text('Total');
    doc.moveTo(48, doc.y + 2).lineTo(547, doc.y + 2).stroke('#ccc');
    doc.moveDown(0.4);

    for (const l of lines) {
      const taxAmt = inv.isInterState ? l.igst : l.cgst + l.sgst;
      doc.fillColor('#333');
      doc.text(l.name.slice(0, 38), 48, doc.y, { continued: true, width: 200 });
      doc.text(l.hsn, { continued: true, width: 50 });
      doc.text(String(l.qty), { continued: true, width: 35 });
      doc.text(inr(l.taxableValue), { continued: true, width: 75 });
      doc.text(`${inr(taxAmt)} (${l.gstRate}%)`, { continued: true, width: 75 });
      doc.text(inr(l.total));
    }

    doc.moveTo(48, doc.y + 4).lineTo(547, doc.y + 4).stroke('#ccc');
    doc.moveDown(0.6).fillColor('#000');

    const right = (label: string, val: string) => {
      doc.fontSize(9).text(`${label}: ${val}`, { align: 'right' });
    };
    right('Subtotal (taxable)', inr(inv.subtotal));
    if (inv.isInterState) right('IGST', inr(inv.igst));
    else { right('CGST', inr(inv.cgst)); right('SGST', inr(inv.sgst)); }
    if (Number(inv.shippingTotal) > 0) right('Shipping', inr(inv.shippingTotal));
    if (Number(inv.discountTotal) > 0) right('Discount', `- ${inr(inv.discountTotal)}`);
    doc.fontSize(11).text(`Grand Total: ${inr(inv.grandTotal)}`, { align: 'right' });

    doc.moveDown(2).fontSize(8).fillColor('#999')
      .text(inv.platformGstin ? `Facilitated by ${inv.platformName} · GSTIN ${inv.platformGstin}` : `Facilitated by ${inv.platformName ?? 'Vrindaonline'}`, { align: 'center' })
      .text('This is a computer-generated invoice.', { align: 'center' });

    doc.end();
  });
}
