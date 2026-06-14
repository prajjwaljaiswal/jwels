'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { OrderItem } from '../../page';

interface VendorProfile {
  shopName: string;
  email: string;
  phone: string | null;
}

interface VendorAddress {
  contactName: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export default function PrintLabelPage() {
  const params = useParams<{ id: string }>();
  const itemId = params?.id;

  const [item, setItem]       = useState<OrderItem | null>(null);
  const [vendor, setVendor]   = useState<VendorProfile | null>(null);
  const [address, setAddress] = useState<VendorAddress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<OrderItem[]>('/api/vendors/me/orders'),
      api<VendorProfile>('/api/vendors/me'),
      api<VendorAddress | null>('/api/shipping/vendor/address').catch(() => null),
    ]).then(([orders, v, addr]) => {
      const found = orders.find((i) => i.id === itemId) ?? null;
      setItem(found);
      setVendor(v);
      setAddress(addr);
    }).finally(() => setLoading(false));
  }, [itemId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500 text-sm">
        Loading label…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500 text-sm">
        Order not found.
      </div>
    );
  }

  const addr   = item.order.shippingAddress as any;
  const awb    = item.shipment?.awb ?? item.trackingNumber;
  const carrier = item.shippingCarrier ?? item.shipment?.carrierName ?? '';
  const orderId = item.order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(item.order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back
        </button>
        <span className="flex-1 text-sm font-medium text-gray-700">
          Shipping Label — Order #{orderId}
        </span>
        <button
          onClick={() => window.print()}
          className="bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-md hover:bg-brand-700 transition"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* Label — A5 sized, centered */}
      <div className="flex justify-center py-10 print:py-0">
        <div
          className="bg-white shadow-lg print:shadow-none w-[148mm] min-h-[210mm] print:w-full print:min-h-0 flex flex-col border border-gray-300 print:border-0"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* Header strip */}
          <div className="bg-gray-900 text-white px-5 py-3 flex justify-between items-center">
            <span className="font-bold text-base tracking-wide">{vendor?.shopName ?? 'Vrindaonline Store'}</span>
            <span className="text-xs opacity-70">SHIPPING LABEL</span>
          </div>

          {/* AWB / carrier bar */}
          {(awb || carrier) && (
            <div className="border-b border-gray-200 px-5 py-3 flex justify-between items-center bg-gray-50">
              {awb && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">AWB / Tracking</p>
                  <p className="font-mono font-bold text-lg text-gray-900 tracking-wider">{awb}</p>
                </div>
              )}
              {carrier && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Carrier</p>
                  <p className="font-semibold text-sm text-gray-700">{carrier}</p>
                </div>
              )}
            </div>
          )}

          {/* TO / FROM addresses */}
          <div className="flex flex-1 divide-x divide-gray-200">
            {/* TO */}
            <div className="flex-1 p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Deliver To</p>
              <p className="font-bold text-base text-gray-900">{addr?.name}</p>
              {addr?.phone && <p className="text-sm text-gray-700 mt-0.5">{addr.phone}</p>}
              <div className="mt-2 text-sm text-gray-700 leading-relaxed">
                {addr?.line1 && <p>{addr.line1}</p>}
                {addr?.line2 && <p>{addr.line2}</p>}
                <p>
                  {[addr?.city, addr?.state].filter(Boolean).join(', ')}
                  {addr?.pincode ? ` – ${addr.pincode}` : ''}
                </p>
                {addr?.country && addr.country !== 'India' && <p>{addr.country}</p>}
              </div>
            </div>

            {/* FROM */}
            <div className="w-[45%] p-5 bg-gray-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Return To</p>
              <p className="font-semibold text-sm text-gray-900">{address?.contactName ?? vendor?.shopName}</p>
              {(address?.phone ?? vendor?.phone) && (
                <p className="text-xs text-gray-600 mt-0.5">{address?.phone ?? vendor?.phone}</p>
              )}
              {address ? (
                <div className="mt-2 text-xs text-gray-600 leading-relaxed">
                  {address.line1 && <p>{address.line1}</p>}
                  {address.line2 && <p>{address.line2}</p>}
                  <p>
                    {[address.city, address.state].filter(Boolean).join(', ')}
                    {address.postalCode ? ` – ${address.postalCode}` : ''}
                  </p>
                </div>
              ) : vendor?.email && (
                <p className="mt-2 text-xs text-gray-600">{vendor.email}</p>
              )}
            </div>
          </div>

          {/* Order details */}
          <div className="border-t border-gray-200 px-5 py-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-gray-400 uppercase tracking-wider">Order Ref</span>
                <p className="font-mono font-semibold text-gray-800 mt-0.5">#{orderId}</p>
              </div>
              <div>
                <span className="text-gray-400 uppercase tracking-wider">Date</span>
                <p className="font-semibold text-gray-800 mt-0.5">{orderDate}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 uppercase tracking-wider">Item</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {item.product.name} × {item.quantity}
                </p>
              </div>
              {item.order.paymentMethod === 'COD' && (
                <div className="col-span-2">
                  <span className="inline-block bg-amber-100 text-amber-700 border border-amber-300 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                    CASH ON DELIVERY
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-5 py-2 bg-gray-50 text-[9px] text-gray-400 flex justify-between">
            <span>Generated by Vrindaonline Marketplace</span>
            <span>Item ID: {itemId?.slice(0, 12)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
