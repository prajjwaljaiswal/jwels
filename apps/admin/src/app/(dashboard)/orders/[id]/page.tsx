'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface OrderDetail {
  id: string;
  status: string;
  totalAmount: string;
  shippingTotal: string;
  discountAmount: string;
  giftWrap?: boolean;
  giftWrapFee?: string;
  paymentMethod: string;
  createdAt: string;
  shippingAddress: any;
  customer: { name: string; email: string; phone: string | null } | null;
  invoice: { invoiceNumber: string } | null;
  items: {
    id: string; quantity: number; priceAtPurchase: string; status: string;
    product: { name: string; images: string[] } | null;
    vendor: { shopName: string } | null;
    returns: { id: string; status: string; refundStatus: string }[];
  }[];
  returns: { id: string; status: string; reason: string; refundAmount: string }[];
}

export default function AdminOrderDetail() {
  const { code } = useCurrency();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api<OrderDetail>(`/api/admin/orders/${id}`).then(setOrder).catch(() => setOrder(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="h-40 bg-surface border border-line rounded-md animate-pulse" />;
  if (!order) return <Card className="p-10 text-center text-ink-700">Order not found.</Card>;

  const addr = order.shippingAddress || {};

  return (
    <div>
      <div className="text-xs mb-3"><Link href="/orders" className="text-ink-500 hover:text-ink-900">← Back to orders</Link></div>
      <PageHeader
        title={`Order #${order.id.slice(0, 8).toUpperCase()}`}
        subtitle={`Placed ${new Date(order.createdAt).toLocaleString('en-IN')} · ${order.paymentMethod}`}
        actions={<StatusPill tone={order.status === 'REFUNDED' || order.status === 'CANCELLED' ? 'danger' : 'success'}>{order.status}</StatusPill>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <h2 className="font-semibold text-ink-900 mb-4">Items</h2>
          <ul className="divide-y divide-line">
            {order.items.map((it) => (
              <li key={it.id} className="py-3 flex items-center gap-3">
                <img src={it.product?.images?.[0] || '/placeholder.png'} alt="" className="h-12 w-12 rounded object-cover bg-canvas" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{it.product?.name ?? 'Item'}</p>
                  <p className="text-xs text-ink-500">Qty {it.quantity} · {it.vendor?.shopName ?? '—'}{it.returns.length > 0 && ` · return: ${it.returns[0].status}`}</p>
                </div>
                <span className="text-sm">{formatPrice(Number(it.priceAtPurchase) * it.quantity, code)}</span>
                <StatusPill tone={it.status === 'REFUNDED' ? 'danger' : 'neutral'}>{it.status}</StatusPill>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-line text-sm space-y-1 text-right">
            {Number(order.discountAmount) > 0 && <p className="text-ink-700">Discount: − {formatPrice(Number(order.discountAmount), code)}</p>}
            {Number(order.shippingTotal) > 0 && <p className="text-ink-700">Shipping: {formatPrice(Number(order.shippingTotal), code)}</p>}
            {order.giftWrap && <p className="text-ink-700">Gift wrap: {formatPrice(Number(order.giftWrapFee || 0), code)}</p>}
            <p className="font-bold text-ink-900">Total: {formatPrice(Number(order.totalAmount), code)}</p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-ink-900 mb-2">Customer</h2>
            <p className="text-sm text-ink-900">{order.customer?.name}</p>
            <p className="text-sm text-ink-700">{order.customer?.email}</p>
            {order.customer?.phone && <p className="text-sm text-ink-700">{order.customer.phone}</p>}
            <h3 className="font-semibold text-ink-900 mt-4 mb-1 text-sm">Shipping to</h3>
            <p className="text-sm text-ink-700">{addr.name}, {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} {addr.pincode}</p>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold text-ink-900 mb-2">Invoice</h2>
            {order.invoice ? <p className="text-sm font-mono text-ink-900">{order.invoice.invoiceNumber}</p> : <p className="text-sm text-ink-500">Not generated yet</p>}
            {order.returns.length > 0 && (
              <p className="text-xs text-ink-700 mt-3">{order.returns.length} return(s) — manage in <Link href="/returns" className="text-brand-700 hover:underline">Returns</Link></p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
