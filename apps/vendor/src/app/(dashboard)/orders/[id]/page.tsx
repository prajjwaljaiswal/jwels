'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';
import type { OrderItem, ShipmentInfo } from '../page';

const COURIER_CHIPS = ['Delhivery', 'Bluedart', 'DTDC', 'FedEx', 'India Post'];

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  PENDING:   [{ value: 'SHIPPED', label: 'Shipped' }, { value: 'CANCELLED', label: 'Cancelled' }],
  PAID:      [{ value: 'SHIPPED', label: 'Shipped' }, { value: 'CANCELLED', label: 'Cancelled' }],
  SHIPPED:   [{ value: 'DELIVERED', label: 'Delivered' }, { value: 'CANCELLED', label: 'Cancelled' }],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED:  [],
};

function statusTone(s: string): 'success' | 'info' | 'danger' | 'warn' {
  if (s === 'DELIVERED') return 'success';
  if (s === 'SHIPPED')   return 'info';
  if (s === 'CANCELLED') return 'danger';
  return 'warn';
}

function statusLabel(s: string) {
  return s === 'PENDING' ? 'COD PENDING' : s;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function VendorOrderDetailPage() {
  const { code } = useCurrency();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const itemId = params?.id;

  const [item, setItem]       = useState<OrderItem | null>(null);
  const [genLabelLoading, setGenLabelLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateErr, setUpdateErr] = useState('');
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [dispatchForm, setDispatchForm] = useState({
    courierName: '', trackingNumber: '', trackingUrl: '', waybillUrl: '',
  });
  const [waybillUploading, setWaybillUploading] = useState(false);
  const waybillInputRef = useRef<HTMLInputElement>(null);

  const [awbForm, setAwbForm]       = useState({ carrierName: '', awb: '', trackingUrl: '' });
  const [awbFormOpen, setAwbFormOpen] = useState(false);
  const [awbSaving, setAwbSaving]   = useState(false);

  async function load() {
    try {
      const all = await api<OrderItem[]>('/api/vendors/me/orders');
      const found = all.find((i) => i.id === itemId);
      if (!found) { setNotFound(true); return; }
      setItem(found);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleWaybillUpload(file: File) {
    setWaybillUploading(true);
    try {
      const fd = new FormData();
      fd.append('waybill', file);
      const result = await api<{ url: string }>(`/api/orders/items/${itemId}/waybill`, {
        method: 'POST',
        body: fd,
      });
      setDispatchForm((f) => ({ ...f, waybillUrl: result.url }));
      toast.success('Waybill uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setWaybillUploading(false);
    }
  }

  async function submitDispatch() {
    if (!dispatchForm.trackingNumber.trim()) {
      setUpdateErr('AWB / Tracking number is required');
      return;
    }
    setUpdating(true);
    setUpdateErr('');
    try {
      await api(`/api/orders/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'SHIPPED',
          courierName: dispatchForm.courierName || undefined,
          trackingNumber: dispatchForm.trackingNumber,
          trackingUrl: dispatchForm.trackingUrl || undefined,
          waybillUrl: dispatchForm.waybillUrl || undefined,
        }),
      });
      toast.success('Order dispatched');
      setPendingStatus(null);
      await load();
    } catch (e: any) {
      setUpdateErr(e.message);
    } finally {
      setUpdating(false);
    }
  }

  async function createShipmentViaCarrier() {
    setUpdating(true);
    setUpdateErr('');
    try {
      const result = await api<OrderItem>(`/api/shipping/orders/items/${itemId}/ship`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success(result.trackingNumber ? `Shipment created · AWB ${result.trackingNumber}` : 'Marked shipped');
      setPendingStatus(null);
      await load();
    } catch (e: any) {
      setUpdateErr(e.message);
    } finally {
      setUpdating(false);
    }
  }

  async function generateLabel() {
    setGenLabelLoading(true);
    try {
      const result = await api<ShipmentInfo>(`/api/fulfillment/orders/items/${itemId}/generate-label`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (result.awb) {
        toast.success(`AWB generated: ${result.awb}`);
      } else {
        toast.success('Label created (no carrier AWB — print label manually)');
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate label', { duration: 8000 });
    } finally {
      setGenLabelLoading(false);
    }
  }

  async function saveAwb() {
    if (!item) return;
    if (!awbForm.awb.trim())         { toast.error('AWB number is required'); return; }
    if (!awbForm.carrierName.trim()) { toast.error('Select a carrier'); return; }
    setAwbSaving(true);
    try {
      // If no shipment record exists yet, create a blank one (no carrier API called)
      let shipmentId = item.shipment?.id;
      if (!shipmentId) {
        const created = await api<ShipmentInfo>(`/api/fulfillment/orders/items/${itemId}/manual-shipment`, {
          method: 'POST',
        });
        shipmentId = created.id;
      }
      await api(`/api/fulfillment/shipments/${shipmentId}/awb`, {
        method: 'PATCH',
        body: JSON.stringify({
          awb: awbForm.awb.trim(),
          carrierName: awbForm.carrierName,
          trackingUrl: awbForm.trackingUrl.trim() || null,
        }),
      });
      toast.success(`AWB ${awbForm.awb.trim()} saved`);
      setAwbFormOpen(false);
      setAwbForm({ carrierName: '', awb: '', trackingUrl: '' });
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save AWB');
    } finally {
      setAwbSaving(false);
    }
  }

  async function updateStatus(status: string) {
    setUpdating(true);
    setUpdateErr('');
    try {
      await api(`/api/orders/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast.success(`Order marked as ${status.toLowerCase()}`);
      setPendingStatus(null);
      await load();
    } catch (e: any) {
      setUpdateErr(e.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-28 bg-canvas rounded animate-pulse" />
        <div className="h-10 w-64 bg-canvas rounded animate-pulse" />
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="h-40 bg-canvas rounded-md animate-pulse" />
            <div className="h-52 bg-canvas rounded-md animate-pulse" />
            <div className="h-32 bg-canvas rounded-md animate-pulse" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="h-40 bg-canvas rounded-md animate-pulse" />
            <div className="h-40 bg-canvas rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-ink-900 font-semibold text-lg">Order not found</p>
        <Link href="/orders" className="btn-primary inline-block mt-4">Back to orders</Link>
      </div>
    );
  }

  const addr = item.order.shippingAddress;
  const hasLiveCarrier = item.shippingMethodId && !item.trackingNumber;
  const options = STATUS_OPTIONS[item.status] ?? [];

  return (
    <div>
      {/* Back link */}
      <div className="mb-6">
        <Link href="/orders" className="text-sm text-ink-500 hover:text-ink-900">← Back to orders</Link>
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink-900">Order detail</h1>
          <p className="text-sm text-ink-500 mt-1 font-mono">#{item.order.id.slice(-8).toUpperCase()}</p>
        </div>
        <StatusPill tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusPill>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left — main content */}
        <div className="lg:col-span-3 space-y-6">

          {/* Item card */}
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Item</h2>
            <div className="flex gap-5">
              <div className="h-28 w-28 rounded-lg bg-canvas overflow-hidden shrink-0">
                {item.product.images[0] && (
                  <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0 py-1">
                <p className="font-semibold text-ink-900 text-base leading-snug">{item.product.name}</p>
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-ink-700">Qty: <span className="font-medium text-ink-900">{item.quantity}</span></p>
                  <p className="text-sm text-ink-700">Unit price: <span className="font-medium text-ink-900">{formatPrice(item.priceAtPurchase, code)}</span></p>
                  <p className="text-sm text-ink-700 mt-2">Subtotal: <span className="font-semibold text-ink-900 text-base">{formatPrice(Number(item.priceAtPurchase) * item.quantity, code)}</span></p>
                </div>
              </div>
            </div>
          </Card>

          {/* Status management card */}
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-700 shrink-0">Item status</span>
                {options.length > 0 ? (
                  <select
                    value={pendingStatus ?? item.status}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPendingStatus(val === item.status ? null : val);
                      setUpdateErr('');
                      if (val !== 'SHIPPED') {
                        setDispatchForm({ courierName: '', trackingNumber: '', trackingUrl: '', waybillUrl: '' });
                      }
                    }}
                    className="text-sm border border-line rounded-md px-2.5 py-1.5 bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer"
                  >
                    <option value={item.status}>{statusLabel(item.status)}</option>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <StatusPill tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusPill>
                )}
              </div>

              <StatusRow label="Payment">
                <span className={`font-semibold ${item.order.paymentMethod === 'COD' ? 'text-amber-600' : 'text-success'}`}>
                  {item.order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'}
                </span>
              </StatusRow>
              <StatusRow label="Order date">
                <span className="text-ink-900">{fmtDate(item.order.createdAt)}</span>
              </StatusRow>
              {item.dispatchedAt && (
                <StatusRow label="Dispatched">
                  <span className="text-ink-900">{fmtDate(item.dispatchedAt)}</span>
                </StatusRow>
              )}
              {item.deliveredAt && (
                <StatusRow label="Delivered">
                  <span className="text-success font-semibold">{fmtDate(item.deliveredAt)}</span>
                </StatusRow>
              )}
            </div>

            {/* Action area */}
            {updateErr && <p className="text-sm text-danger mt-4">{updateErr}</p>}

            {/* Dispatch form */}
            {pendingStatus === 'SHIPPED' && (
              <div className="mt-4 space-y-4 border-t border-line pt-4">
                {hasLiveCarrier && (
                  <button
                    onClick={createShipmentViaCarrier}
                    disabled={updating}
                    className="btn-primary w-full !py-2.5"
                  >
                    {updating ? 'Creating shipment…' : `Create shipment via ${item.shippingCarrier ?? 'carrier'}`}
                  </button>
                )}

                <div className="bg-canvas border border-line rounded-md p-4 space-y-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
                    {hasLiveCarrier ? 'Or enter manually' : 'Dispatch details'}
                  </p>

                  <div>
                    <label className="text-xs text-ink-500 mb-2 block">Courier</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {COURIER_CHIPS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDispatchForm((f) => ({ ...f, courierName: f.courierName === c ? '' : c }))}
                          className={[
                            'text-xs px-2.5 py-1 rounded-full border transition',
                            dispatchForm.courierName === c
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-surface border-line text-ink-700 hover:border-brand-400',
                          ].join(' ')}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Or type courier name…"
                      value={dispatchForm.courierName}
                      onChange={(e) => setDispatchForm((f) => ({ ...f, courierName: e.target.value }))}
                      className="input-base w-full text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-ink-500 mb-2 block">
                      AWB / Tracking No. <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1234567890"
                      value={dispatchForm.trackingNumber}
                      onChange={(e) => setDispatchForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                      className="input-base w-full text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-ink-500 mb-2 block">Tracking link (optional)</label>
                    <input
                      type="url"
                      placeholder="https://…"
                      value={dispatchForm.trackingUrl}
                      onChange={(e) => setDispatchForm((f) => ({ ...f, trackingUrl: e.target.value }))}
                      className="input-base w-full text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-ink-500 mb-2 block">Waybill document (optional)</label>
                    <input
                      ref={waybillInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleWaybillUpload(f);
                      }}
                    />
                    {dispatchForm.waybillUrl ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-success">Waybill uploaded</span>
                        <button
                          type="button"
                          onClick={() => setDispatchForm((f) => ({ ...f, waybillUrl: '' }))}
                          className="text-xs text-danger hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={waybillUploading}
                        onClick={() => waybillInputRef.current?.click()}
                        className="text-sm text-brand-700 border border-dashed border-brand-300 rounded-md px-3 py-2.5 hover:bg-brand-50 transition w-full text-center"
                      >
                        {waybillUploading ? 'Uploading…' : '+ Upload waybill PDF or image'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setPendingStatus(null); setDispatchForm({ courierName: '', trackingNumber: '', trackingUrl: '', waybillUrl: '' }); }}
                    className="btn-secondary flex-1 !py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDispatch}
                    disabled={updating || waybillUploading}
                    className="btn-primary flex-1 !py-2.5 text-sm"
                  >
                    {updating ? 'Dispatching…' : 'Confirm dispatch →'}
                  </button>
                </div>
              </div>
            )}

            {/* DELIVERED / CANCELLED confirm */}
            {(pendingStatus === 'DELIVERED' || pendingStatus === 'CANCELLED') && (
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <button
                  onClick={() => setPendingStatus(null)}
                  className="btn-secondary flex-1 !py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateStatus(pendingStatus)}
                  disabled={updating}
                  className={`flex-1 !py-2.5 text-sm font-semibold rounded-md transition ${
                    pendingStatus === 'CANCELLED'
                      ? 'bg-danger text-white hover:opacity-90'
                      : 'btn-primary'
                  }`}
                >
                  {updating ? 'Updating…' : `Confirm ${pendingStatus.toLowerCase()}`}
                </button>
              </div>
            )}

            {!pendingStatus && options.length > 0 && (
              <p className="text-xs text-ink-500 mt-3">Select a new status above to take action.</p>
            )}
          </Card>

          {/* Shipment info */}
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Shipment</h2>
            <div className="space-y-3">
              {item.shippingCarrier ? (
                <DetailRow label="Carrier" value={`${item.shippingCarrier}${item.shippingService ? ` · ${item.shippingService}` : ''}`} />
              ) : (
                <p className="text-sm text-ink-500">No shipping method attached.</p>
              )}
              {item.shippingCost != null && Number(item.shippingCost) > 0 && (
                <DetailRow label="Charged" value={formatPrice(item.shippingCost, code)} />
              )}
              {item.trackingNumber && <DetailRow label="AWB" value={item.trackingNumber} />}
              {item.trackingUrl && (
                <LinkRow label="Track" href={item.trackingUrl} text="Open tracking page ↗" />
              )}
              {item.labelUrl && (
                <LinkRow label="Label" href={item.labelUrl} text="Download label PDF ↗" />
              )}
              {item.waybillUrl && (
                <LinkRow label="Waybill" href={item.waybillUrl} text="Download waybill ↗" />
              )}
              {!item.shippingCarrier && !item.trackingNumber && (
                <p className="text-sm text-ink-500">No shipment created yet.</p>
              )}
            </div>
          </Card>

          {/* Fulfillment actions card */}
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Fulfillment</h2>
            {!item.shipment ? (
              <div className="space-y-3">
                {awbFormOpen ? (
                  <div className="border border-line rounded-md p-4 space-y-3 bg-surface">
                    <p className="text-xs font-semibold text-ink-700">Enter AWB Details</p>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Carrier / Service</label>
                      <select
                        value={awbForm.carrierName}
                        onChange={(e) => setAwbForm((f) => ({ ...f, carrierName: e.target.value }))}
                        className="input text-sm w-full"
                      >
                        <option value="">— Select carrier —</option>
                        <option value="DELHIVERY">Delhivery</option>
                        <option value="DTDC">DTDC</option>
                        <option value="BLUEDART">Blue Dart</option>
                        <option value="FEDEX">FedEx</option>
                        <option value="SHIPROCKET">Shiprocket</option>
                        <option value="INDIA_POST">India Post</option>
                        <option value="ECOM_EXPRESS">Ecom Express</option>
                        <option value="XPRESSBEES">XpressBees</option>
                        <option value="SHADOWFAX">Shadowfax</option>
                        <option value="USPS">USPS</option>
                        <option value="CUSTOM">Other / Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">AWB / Tracking Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 1234567890"
                        value={awbForm.awb}
                        onChange={(e) => setAwbForm((f) => ({ ...f, awb: e.target.value }))}
                        className="input text-sm w-full font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Tracking URL <span className="text-ink-400">(optional)</span></label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={awbForm.trackingUrl}
                        onChange={(e) => setAwbForm((f) => ({ ...f, trackingUrl: e.target.value }))}
                        className="input text-sm w-full"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveAwb} disabled={awbSaving} className="btn-primary text-sm !py-1.5 !px-4">
                        {awbSaving ? 'Saving…' : 'Save AWB'}
                      </button>
                      <button onClick={() => { setAwbFormOpen(false); setAwbForm({ carrierName: '', awb: '', trackingUrl: '' }); }} className="btn-secondary text-sm !py-1.5 !px-3">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-ink-700">No label generated yet.</p>
                    <button
                      onClick={generateLabel}
                      disabled={genLabelLoading || item.status === 'CANCELLED'}
                      className="btn-primary w-full !py-2.5 text-sm"
                    >
                      {genLabelLoading ? 'Generating…' : 'Generate Label via Carrier'}
                    </button>
                    <p className="text-xs text-center text-ink-400">or</p>
                    <button
                      onClick={() => setAwbFormOpen(true)}
                      disabled={item.status === 'CANCELLED'}
                      className="btn-secondary w-full !py-2.5 text-sm"
                    >
                      Enter AWB Manually
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Status</span>
                  <span className="text-sm font-medium text-ink-900">{item.shipment.status.replace(/_/g, ' ')}</span>
                </div>

                {/* AWB display or entry */}
                {item.shipment.awb ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold mb-0.5">
                        {item.shipment.carrierName ?? 'Carrier'} · AWB
                      </p>
                      <p className="font-mono font-bold text-emerald-900 text-base tracking-wide">{item.shipment.awb}</p>
                    </div>
                    <button
                      onClick={() => { setAwbForm({ carrierName: item.shipment!.carrierName ?? '', awb: item.shipment!.awb!, trackingUrl: '' }); setAwbFormOpen(true); }}
                      className="text-xs text-emerald-700 hover:text-emerald-900 underline shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
                    <p className="text-sm text-amber-800 font-medium mb-2">No AWB assigned yet</p>
                    {!awbFormOpen && (
                      <button onClick={() => setAwbFormOpen(true)} className="btn-secondary text-xs !py-1.5 !px-3">
                        + Enter AWB manually
                      </button>
                    )}
                  </div>
                )}

                {/* Manual AWB form */}
                {awbFormOpen && (
                  <div className="border border-line rounded-md p-4 space-y-3 bg-surface">
                    <p className="text-xs font-semibold text-ink-700">Enter AWB Details</p>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Carrier / Service</label>
                      <select
                        value={awbForm.carrierName}
                        onChange={(e) => setAwbForm((f) => ({ ...f, carrierName: e.target.value }))}
                        className="input text-sm w-full"
                      >
                        <option value="">— Select carrier —</option>
                        <option value="DELHIVERY">Delhivery</option>
                        <option value="DTDC">DTDC</option>
                        <option value="BLUEDART">Blue Dart</option>
                        <option value="FEDEX">FedEx</option>
                        <option value="SHIPROCKET">Shiprocket</option>
                        <option value="INDIA_POST">India Post</option>
                        <option value="ECOM_EXPRESS">Ecom Express</option>
                        <option value="XPRESSBEES">XpressBees</option>
                        <option value="SHADOWFAX">Shadowfax</option>
                        <option value="USPS">USPS</option>
                        <option value="CUSTOM">Other / Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">AWB / Tracking Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 1234567890"
                        value={awbForm.awb}
                        onChange={(e) => setAwbForm((f) => ({ ...f, awb: e.target.value }))}
                        className="input text-sm w-full font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Tracking URL <span className="text-ink-400">(optional)</span></label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={awbForm.trackingUrl}
                        onChange={(e) => setAwbForm((f) => ({ ...f, trackingUrl: e.target.value }))}
                        className="input text-sm w-full"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveAwb} disabled={awbSaving} className="btn-primary text-sm !py-1.5 !px-4">
                        {awbSaving ? 'Saving…' : 'Save AWB'}
                      </button>
                      <button onClick={() => { setAwbFormOpen(false); setAwbForm({ carrierName: '', awb: '', trackingUrl: '' }); }} className="btn-secondary text-sm !py-1.5 !px-3">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Label download */}
                {item.shipment.labelUrl ? (
                  <a href={item.shipment.labelUrl} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full btn-primary !py-2.5 text-sm">
                    ↓ Download Label PDF
                  </a>
                ) : (
                  <Link href={`/orders/${item.id}/label`} target="_blank"
                    className="flex items-center justify-center gap-2 w-full btn-secondary !py-2.5 text-sm">
                    🖨 Print Shipping Label
                  </Link>
                )}

                <div className="pt-3 border-t border-line flex flex-wrap gap-2">
                  {item.shipment.status === 'LABEL_GENERATED' && (
                    <>
                      <Link href={`/manifest?select=${item.shipment.id}`} className="btn-secondary text-sm !py-1.5 !px-3">
                        Add to manifest
                      </Link>
                      <Link href="/dispatch" className="btn-secondary text-sm !py-1.5 !px-3">
                        Go to dispatch
                      </Link>
                    </>
                  )}
                  {['MANIFEST_GENERATED', 'PICKUP_SCHEDULED', 'PICKED_UP'].includes(item.shipment.status) && (
                    <Link href="/manifest" className="btn-secondary text-sm !py-1.5 !px-3">
                      View manifest
                    </Link>
                  )}
                  {item.shipment.awb && (
                    <Link href={`/tracking?awb=${item.shipment.awb}`} className="btn-secondary text-sm !py-1.5 !px-3">
                      Track shipment
                    </Link>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Customer</h2>
            <div className="space-y-4">
              <InfoBlock label="Name" value={item.order.customer.name} />
              <InfoBlock label="Email" value={item.order.customer.email} />
              {item.order.customer.phone && (
                <InfoBlock label="Phone" value={item.order.customer.phone} />
              )}
            </div>
          </Card>

          {/* Shipping address */}
          {addr && (
            <Card className="p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Ship to</h2>
              <address className="not-italic space-y-1.5">
                <p className="text-sm font-semibold text-ink-900">{addr.name}</p>
                <p className="text-sm text-ink-700">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                <p className="text-sm text-ink-700">{addr.city}, {addr.state}</p>
                <p className="text-sm text-ink-700">{addr.pincode}</p>
                <p className="text-sm text-ink-500 mt-2">{addr.phone}</p>
              </address>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Horizontal label+value row — used in shipment section
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-ink-500 w-24 shrink-0">{label}</span>
      <span className="text-ink-900 font-medium break-all">{value}</span>
    </div>
  );
}

function LinkRow({ label, href, text }: { label: string; href: string; text: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-ink-500 w-24 shrink-0">{label}</span>
      <a href={href} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline break-all">{text}</a>
    </div>
  );
}

// Stacked label+value block — used in right-rail customer card
function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink-900 break-all">{value}</p>
    </div>
  );
}

// Horizontal row for the status card
function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink-700">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}
