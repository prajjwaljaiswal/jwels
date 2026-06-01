'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';
import { useCurrency, formatPrice } from '@/lib/currency';
import { addressApi, type Address } from '@/lib/addresses';
import { CheckoutStep } from '@/components/checkout/CheckoutStep';

declare global {
  interface Window { Razorpay: any; }
}

type VendorPaymentMethod = {
  id: string;
  provider: 'RAZORPAY' | 'UPI_MANUAL' | 'BANK_TRANSFER' | 'COD';
  label: string;
  isDefault: boolean;
  publicConfig: any;
};

interface QuoteOption {
  methodId: string;
  carrier: string;
  serviceCode: string | null;
  name: string;
  amount: number;
  etaMinDays: number;
  etaMaxDays: number;
  rateMode: 'FLAT' | 'LIVE';
}
interface QuoteGroup {
  vendorId: string;
  itemCount: number;
  subtotal: number;
  options: QuoteOption[];
  warnings?: string[];
}

const PLATFORM_RAZORPAY: VendorPaymentMethod = {
  id: '__platform_razorpay__',
  provider: 'RAZORPAY',
  label: 'Pay online',
  isDefault: true,
  publicConfig: null,
};
const PLATFORM_COD: VendorPaymentMethod = {
  id: '__platform_cod__',
  provider: 'COD',
  label: 'Cash on Delivery',
  isDefault: false,
  publicConfig: null,
};

function methodSubtitle(m: VendorPaymentMethod): string {
  switch (m.provider) {
    case 'RAZORPAY':      return 'UPI, cards, netbanking via Razorpay';
    case 'UPI_MANUAL':    return m.publicConfig?.vpa ? `Pay to ${m.publicConfig.vpa}` : 'Pay via UPI directly to the shop';
    case 'BANK_TRANSFER': return m.publicConfig?.bankName
      ? `Bank transfer · ${m.publicConfig.bankName} ••${m.publicConfig.accountLast4 ?? ''}`
      : 'Direct bank transfer';
    case 'COD':           return 'Pay when your order arrives';
  }
}

export function LegacyVendorCheckoutPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const { vendor, theme, storeKey } = useVendor();
  const { items, setQty, remove, clear } = useCart();
  const [addr, setAddr] = useState({ name: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '' });
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new'>('new');
  const [authed, setAuthed] = useState(false);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [makeNewDefault, setMakeNewDefault] = useState(false);
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);
  const [methods, setMethods] = useState<VendorPaymentMethod[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [codEnabled, setCodEnabled] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState<any>(null);

  // Filter cart to only current vendor's items
  const vendorItems = useMemo(
    () => items.filter((i) => !i.vendorId || i.vendorId === vendor.id),
    [items, vendor.id]
  );
  const otherItems = useMemo(
    () => items.filter((i) => i.vendorId && i.vendorId !== vendor.id),
    [items, vendor.id]
  );

  const [shipQuote, setShipQuote] = useState<QuoteGroup[] | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipError, setShipError] = useState('');
  const [shipSel, setShipSel] = useState<Record<string, { methodId: string; serviceCode: string | null }>>({});

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponErr, setCouponErr] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<Array<{
    id: string;
    code: string;
    scope: 'VENDOR' | 'PRODUCT';
    discountType: 'PERCENT' | 'FLAT';
    value: string;
    minOrderAmount: string | null;
    maxDiscount: string | null;
    expiresAt: string | null;
    products: { id: string; name: string }[];
  }>>([]);

  const subtotal = vendorItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = shipQuote
    ? shipQuote.reduce((sum, g) => {
        const sel = shipSel[g.vendorId];
        const opt = sel ? g.options.find((o) => o.methodId === sel.methodId && o.serviceCode === sel.serviceCode) : null;
        return sum + (opt?.amount ?? 0);
      }, 0)
    : 0;
  const allVendorsCovered = shipQuote
    ? shipQuote.every((g) => g.options.length === 0 || !!shipSel[g.vendorId])
    : false;
  const discount = coupon?.discount ?? 0;
  const grand = Math.max(0, subtotal + shipping - discount);

  function selectionsPayload() {
    return Object.entries(shipSel).map(([vendorId, s]) => ({
      vendorId, methodId: s.methodId, serviceCode: s.serviceCode,
    }));
  }

  useEffect(() => {
    api<{ enabled: boolean }>('/api/settings/cod', { auth: false })
      .then((r) => setCodEnabled(r.enabled))
      .catch(() => {});

    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    setAuthed(!!t);
    if (!t) return;
    addressApi.list()
      .then(({ items }) => {
        setSavedAddresses(items);
        const def = items.find((a) => a.isDefault) ?? items[0];
        if (def) {
          setSelectedAddressId(def.id);
          setAddr({
            name: def.name,
            line1: def.line1,
            line2: def.line2 ?? '',
            city: def.city,
            state: def.state,
            pincode: def.pincode,
            phone: def.phone,
          });
        }
      })
      .catch(() => {});
  }, []);

  function selectAddress(id: string) {
    setSelectedAddressId(id);
    if (id === 'new') {
      setAddr({ name: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '' });
      return;
    }
    const a = savedAddresses.find((x) => x.id === id);
    if (!a) return;
    setAddr({
      name: a.name,
      line1: a.line1,
      line2: a.line2 ?? '',
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      phone: a.phone,
    });
  }

  async function persistNewAddressIfRequested(): Promise<void> {
    if (selectedAddressId !== 'new') return;
    if (!saveNewAddress || !authed) return;
    try {
      const created = await addressApi.create({
        label: newAddressLabel.trim() || null,
        name: addr.name,
        phone: addr.phone,
        line1: addr.line1,
        line2: addr.line2 || null,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        country: 'IN',
        isDefault: makeNewDefault,
      });
      setSavedAddresses((cur) => {
        const cleared = created.isDefault ? cur.map((a) => ({ ...a, isDefault: false })) : cur;
        return [created, ...cleared];
      });
      setSelectedAddressId(created.id);
      toast.success('Address saved to your address book');
    } catch {
      // best effort — don't block the order
    }
  }

  // Load this vendor's configured payment methods (active only). If none, fall back
  // to the platform defaults so checkout still works.
  useEffect(() => {
    api<VendorPaymentMethod[]>(`/api/payments/public/vendors/${vendor.id}/methods`, { auth: false, silent: true })
      .then((rows) => {
        const list = rows && rows.length > 0 ? rows : [PLATFORM_RAZORPAY, ...(codEnabled ? [PLATFORM_COD] : [])];
        setMethods(list);
        const def = list.find((m) => m.isDefault) ?? list[0];
        if (def) setSelectedId(def.id);
      })
      .catch(() => {
        const list = [PLATFORM_RAZORPAY, ...(codEnabled ? [PLATFORM_COD] : [])];
        setMethods(list);
        setSelectedId(list[0].id);
      });
  }, [vendor.id, codEnabled]);

  const selectedMethod = methods.find((m) => m.id === selectedId) ?? null;

  // Fetch shipping quote when destination is filled in
  useEffect(() => {
    if (vendorItems.length === 0) { setShipQuote(null); return; }
    const pinOk = /^\d{6}$/.test(addr.pincode);
    const stateOk = addr.state.trim().length >= 2;
    if (!pinOk || !stateOk) { setShipQuote(null); return; }

    const ctrl = new AbortController();
    setShipLoading(true);
    setShipError('');
    const isCOD = !!selectedMethod && selectedMethod.provider === 'COD';
    api<{ groups: QuoteGroup[] }>('/api/shipping/quote', {
      method: 'POST',
      auth: false,
      silent: true,
      signal: ctrl.signal,
      body: JSON.stringify({
        items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
        destination: { postalCode: addr.pincode, state: addr.state, country: 'IN' },
        paymentMode: isCOD ? 'COD' : 'PREPAID',
      }),
    } as any)
      .then((res) => {
        setShipQuote(res.groups);
        setShipSel((prev) => {
          const next = { ...prev };
          for (const g of res.groups) {
            const stillValid = next[g.vendorId] && g.options.find(
              (o) => o.methodId === next[g.vendorId].methodId && o.serviceCode === next[g.vendorId].serviceCode,
            );
            if (!stillValid && g.options.length > 0) {
              const cheapest = g.options[0];
              next[g.vendorId] = { methodId: cheapest.methodId, serviceCode: cheapest.serviceCode };
            }
          }
          return next;
        });
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') setShipError(e?.message || 'Failed to load shipping options');
      })
      .finally(() => setShipLoading(false));

    return () => ctrl.abort();
  }, [vendorItems, addr.pincode, addr.state, selectedMethod?.provider]);

  // Fetch this shop's currently available coupons
  useEffect(() => {
    api<any[]>(`/api/coupons/public/vendor/${vendor.id}`, { auth: false, silent: true })
      .then((rows) => setAvailableCoupons(rows))
      .catch(() => {});
  }, [vendor.id]);

  // Re-validate applied coupon whenever the cart changes
  useEffect(() => {
    if (!coupon) return;
    if (vendorItems.length === 0) { setCoupon(null); return; }
    api<{ discount: number; code: string }>('/api/coupons/preview', {
      method: 'POST',
      silent: true,
      body: JSON.stringify({
        code: coupon.code,
        vendorId: vendor.id,
        items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
      }),
    })
      .then((r) => setCoupon({ code: r.code, discount: r.discount }))
      .catch((e: any) => {
        setCoupon(null);
        setCouponErr(e?.message || 'Coupon no longer applies');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorItems]);

  async function applyCouponCode(rawCode: string) {
    setCouponErr('');
    const code = rawCode.trim().toUpperCase();
    if (!code || vendorItems.length === 0) return;
    setCouponBusy(true);
    try {
      const r = await api<{ discount: number; code: string }>('/api/coupons/preview', {
        method: 'POST',
        silent: true,
        body: JSON.stringify({
          code,
          vendorId: vendor.id,
          items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
        }),
      });
      setCoupon({ code: r.code, discount: r.discount });
      setCouponInput('');
    } catch (e: any) {
      setCouponErr(e?.message || 'Coupon could not be applied');
    } finally {
      setCouponBusy(false);
    }
  }

  function applyCoupon() { applyCouponCode(couponInput); }

  function removeCoupon() {
    setCoupon(null);
    setCouponErr('');
  }

  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  function clearVendorItems() {
    vendorItems.forEach((i) => remove(i.productId, i.variationComboId));
  }

  function validateAddr(): string[] {
    const missing: string[] = [];
    if (addr.name.trim().length < 2)   missing.push('Full name');
    if (addr.line1.trim().length < 2)  missing.push('Address line 1');
    if (addr.city.trim().length < 2)   missing.push('City');
    if (addr.state.trim().length < 2)  missing.push('State');
    if (!/^\d{6}$/.test(addr.pincode)) missing.push('Pincode (6 digits)');
    if (addr.phone.trim().length < 10) missing.push('Phone (10 digits)');
    return missing;
  }

  const addressComplete  = validateAddr().length === 0;
  const shippingComplete = addressComplete && allVendorsCovered;

  function advanceFromAddress() {
    const missing = validateAddr();
    if (missing.length > 0) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    setErr('');
    setCurrentStep(1);
  }
  function advanceFromShipping() {
    if (!allVendorsCovered) { setErr('Please pick a shipping option'); return; }
    setErr('');
    setCurrentStep(2);
  }

  async function placeOffGateway() {
    setErr('');
    const missing = validateAddr();
    if (missing.length > 0) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    if (!selectedMethod) { setErr('Select a payment method'); return; }
    if (!allVendorsCovered) { setErr('Select a shipping option'); return; }

    setLoading(true);
    try {
      await persistNewAddressIfRequested();
      const isPlatform = selectedMethod.id.startsWith('__platform_');
      const res = await api<{ orderId: string; paymentInstructions?: any }>('/api/orders/cod', {
        method: 'POST',
        body: JSON.stringify({
          items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
          shippingAddress: addr,
          shippingSelections: selectionsPayload(),
          ...(isPlatform ? {} : { paymentMethodId: selectedMethod.id }),
          couponCode: coupon?.code,
        }),
      });

      // For UPI/bank, show the payout instructions before navigating away.
      if (res.paymentInstructions && (selectedMethod.provider === 'UPI_MANUAL' || selectedMethod.provider === 'BANK_TRANSFER')) {
        setPaymentInstructions({ provider: selectedMethod.provider, data: res.paymentInstructions, orderId: res.orderId });
        clearVendorItems();
        setLoading(false);
        return;
      }

      toast.success('Order placed!');
      clearVendorItems();
      router.push(`/${storeKey}/orders`);
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  async function payOnline() {
    setErr('');
    const missing = validateAddr();
    if (missing.length > 0) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    if (!selectedMethod) { setErr('Select a payment method'); return; }
    if (!allVendorsCovered) { setErr('Select a shipping option'); return; }

    setLoading(true);
    try {
      await persistNewAddressIfRequested();
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error('Failed to load payment gateway');

      const isPlatform = selectedMethod.id.startsWith('__platform_');
      const checkout = await api<{
        orderId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        razorpayKeyId: string;
      }>('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: vendorItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
          shippingAddress: addr,
          shippingSelections: selectionsPayload(),
          ...(isPlatform ? {} : { paymentMethodId: selectedMethod.id }),
          couponCode: coupon?.code,
        }),
      });

      const rzp = new window.Razorpay({
        key: checkout.razorpayKeyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.razorpayOrderId,
        name: vendor.shopName,
        prefill: { name: addr.name, contact: addr.phone },
        handler: async (response: any) => {
          try {
            await api('/api/orders/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                orderId: checkout.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            toast.success('Payment successful — order confirmed!');
            clearVendorItems();
            router.push(`/${storeKey}/orders`);
          } catch (e: any) {
            setErr(`Payment verification failed: ${e.message}`);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: theme },
      });
      rzp.open();
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  function handlePlace() {
    if (!selectedMethod) { setErr('Select a payment method'); return; }
    if (selectedMethod.provider === 'RAZORPAY') payOnline();
    else placeOffGateway();
  }

  if (vendorItems.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-md mx-auto text-center bg-surface border border-line rounded-md shadow-card p-10">
          <div
            className="inline-flex h-14 w-14 rounded-full items-center justify-center mb-4 text-white"
            style={{ background: theme }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
            </svg>
          </div>
          <h1 className="font-display text-3xl text-ink-900 mb-2">Your cart is empty</h1>
          <p className="text-ink-700 mb-6">Add something from {vendor.shopName} to get started.</p>
          <Link
            href={`/${storeKey}`}
            className="inline-block px-5 py-2.5 rounded-pill text-white font-semibold hover:opacity-90"
            style={{ background: theme }}
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4">
        <Link href={`/${storeKey}`} className="hover:opacity-70" style={{ color: theme }}>{vendor.shopName}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">Checkout</span>
      </nav>

      <h1 className="font-display text-3xl text-ink-900 mb-2">Checkout</h1>
      <p className="text-sm text-ink-500 mb-6">Items from <span className="font-semibold" style={{ color: theme }}>{vendor.shopName}</span></p>

      {otherItems.length > 0 && (
        <div className="mb-6 p-3 rounded-md text-sm border" style={{ background: `${theme}10`, borderColor: `${theme}40`, color: theme }}>
          You have {otherItems.length} item{otherItems.length > 1 ? 's' : ''} from another shop in your cart — they'll be checked out separately.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        <div className="space-y-4">
          {/* Cart block intentionally removed — review happens on /store/$vendorId/cart */}
          {false && (
          <section className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="font-semibold text-ink-900">Your cart</h2>
              <Link href={`/${storeKey}`} className="text-sm hover:underline" style={{ color: theme }}>Continue shopping</Link>
            </div>
            <ul className="divide-y divide-line">
              {vendorItems.map((i) => (
                <li key={`${i.productId}::${i.variationComboId ?? ''}`} className="p-5 flex gap-4">
                  <div className="h-20 w-20 rounded-md bg-canvas overflow-hidden shrink-0">
                    {i.image && <img src={i.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 line-clamp-2">{i.name}</p>
                    {i.variationLabel && <p className="text-xs text-ink-700 mt-0.5">{i.variationLabel}</p>}
                    <p className="text-xs text-ink-500 mt-0.5">by {i.vendorName}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="inline-flex items-center border border-line rounded-pill overflow-hidden">
                        <button onClick={() => setQty(i.productId, Math.max(1, i.quantity - 1), i.variationComboId)} className="w-8 h-8 hover:bg-canvas text-ink-700">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                        <button onClick={() => setQty(i.productId, i.quantity + 1, i.variationComboId)} className="w-8 h-8 hover:bg-canvas text-ink-700">+</button>
                      </div>
                      <button onClick={() => remove(i.productId, i.variationComboId)} className="text-xs text-ink-500 hover:text-red-600 underline underline-offset-4">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-ink-900">{formatPrice(i.price * i.quantity, code)}</p>
                    {i.quantity > 1 && (
                      <p className="text-xs text-ink-500 mt-0.5">
                        {formatPrice(i.price, code)} × {i.quantity}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          )}

          <CheckoutStep
            index={1}
            title="Shipping address"
            isActive={currentStep === 0}
            isComplete={addressComplete}
            isLocked={false}
            onEdit={() => setCurrentStep(0)}
            summary={addressComplete ? `${addr.name} · ${addr.line1}, ${addr.city} ${addr.pincode}` : 'Add a delivery address'}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-ink-500">We'll use this to deliver your order and send tracking updates.</p>
              {savedAddresses.length > 0 && (
                <Link href={`/${storeKey}/addresses`} className="text-xs hover:underline" style={{ color: theme }}>Manage</Link>
              )}
            </div>
            {savedAddresses.length > 0 && (
              <div className="space-y-2 mb-4">
                {savedAddresses.map((a) => {
                  const sel = selectedAddressId === a.id;
                  return (
                    <label key={a.id} className={`flex gap-3 p-3 rounded-md border cursor-pointer ${sel ? 'border-brand-500 bg-brand-50/40' : 'border-line hover:border-ink-700'}`}>
                      <input type="radio" name="store-saved-address" checked={sel} onChange={() => selectAddress(a.id)} className="mt-1" />
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-900">{a.name}</span>
                          {a.label && <span className="text-[11px] uppercase tracking-wide text-ink-500">· {a.label}</span>}
                          {a.isDefault && <span className="text-[11px] uppercase tracking-wide bg-brand-50 text-brand-700 border border-brand-500/40 rounded-pill px-2 py-0.5">Default</span>}
                        </div>
                        <p className="text-ink-700 mt-0.5">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}</p>
                        <p className="text-ink-500 text-xs mt-0.5">{a.phone}</p>
                      </div>
                    </label>
                  );
                })}
                <label className={`flex gap-3 p-3 rounded-md border cursor-pointer ${selectedAddressId === 'new' ? 'border-brand-500 bg-brand-50/40' : 'border-line hover:border-ink-700'}`}>
                  <input type="radio" name="store-saved-address" checked={selectedAddressId === 'new'} onChange={() => selectAddress('new')} className="mt-1" />
                  <span className="text-sm font-semibold text-ink-900">+ Use a new address</span>
                </label>
              </div>
            )}
            <div className={`space-y-4 ${savedAddresses.length > 0 && selectedAddressId !== 'new' ? 'hidden' : ''}`}>
              <Field label="Full name">
                <input className="input-field" placeholder="As it appears on your ID"
                  value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} />
              </Field>
              <Field label="Address line 1">
                <input className="input-field" placeholder="Flat / House no., building, street"
                  value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
              </Field>
              <Field label="Address line 2 (optional)">
                <input className="input-field" placeholder="Area, landmark"
                  value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className="input-field"
                    value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input className="input-field"
                    value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pincode">
                  <input className="input-field" inputMode="numeric" maxLength={6} placeholder="6 digits"
                    value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                </Field>
                <Field label="Phone">
                  <input className="input-field" inputMode="numeric" placeholder="10-digit mobile"
                    value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} />
                </Field>
              </div>

              {authed && (
                <div className="pt-2 border-t border-line space-y-3">
                  <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveNewAddress}
                      onChange={(e) => setSaveNewAddress(e.target.checked)}
                      className="rounded border-line accent-brand-600"
                    />
                    Save this address to my address book
                  </label>
                  {saveNewAddress && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end pl-6">
                      <Field label="Label (optional)">
                        <input
                          className="input-field"
                          placeholder="Home, Office, Mom's place…"
                          value={newAddressLabel}
                          onChange={(e) => setNewAddressLabel(e.target.value)}
                        />
                      </Field>
                      <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer pb-2 sm:pb-3">
                        <input
                          type="checkbox"
                          checked={makeNewDefault}
                          onChange={(e) => setMakeNewDefault(e.target.checked)}
                          className="rounded border-line accent-brand-600"
                        />
                        Set as default
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-line flex justify-end">
              <button onClick={advanceFromAddress} className="btn-primary !px-6">Continue to shipping</button>
            </div>
          </CheckoutStep>

          <CheckoutStep
            index={2}
            title="Shipping"
            isActive={currentStep === 1}
            isComplete={shippingComplete}
            isLocked={!addressComplete}
            onEdit={() => setCurrentStep(1)}
            summary={shippingComplete && shipQuote
              ? shipQuote.map((g) => {
                  const o = g.options.find((opt) => {
                    const s = shipSel[g.vendorId];
                    return s && opt.methodId === s.methodId && opt.serviceCode === s.serviceCode;
                  });
                  return o ? `${o.name} · ${o.etaMinDays}–${o.etaMaxDays} days · ${o.amount === 0 ? 'Free' : formatPrice(o.amount, code)}` : '';
                }).filter(Boolean).join(' · ')
              : addressComplete ? 'Pick a delivery option' : 'Complete address first'
            }
          >
            <p className="text-xs text-ink-500 mb-3">Pick a delivery option. Rates load after you fill in pincode and state.</p>
            <div className="space-y-4">
              {!/^\d{6}$/.test(addr.pincode) || addr.state.trim().length < 2 ? (
                <p className="text-sm text-ink-500">Enter your pincode and state to see shipping options.</p>
              ) : shipLoading ? (
                <p className="text-sm text-ink-500">Loading shipping options…</p>
              ) : shipError ? (
                <p className="text-sm" style={{ color: '#dc2626' }}>{shipError}</p>
              ) : !shipQuote || shipQuote.length === 0 ? (
                <p className="text-sm text-ink-500">No shipping options available.</p>
              ) : (
                <div className="space-y-3">
                  {shipQuote.map((g) => {
                    if (g.options.length === 0) {
                      return (
                        <p key={g.vendorId} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                          This shop has no shipping methods to your area. Please contact them.
                        </p>
                      );
                    }
                    const sel = shipSel[g.vendorId];
                    return (
                      <div key={g.vendorId} className="space-y-2">
                        {g.options.map((o) => {
                          const id = `${g.vendorId}-${o.methodId}-${o.serviceCode ?? 'na'}`;
                          const checked = !!sel && sel.methodId === o.methodId && sel.serviceCode === o.serviceCode;
                          return (
                            <label
                              key={id}
                              htmlFor={id}
                              className="flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors"
                              style={checked
                                ? { borderColor: theme, background: `${theme}10` }
                                : { borderColor: '#e5e7eb', background: '#fff' }}
                            >
                              <input
                                id={id}
                                type="radio"
                                name={`ship-${g.vendorId}`}
                                checked={checked}
                                onChange={() => setShipSel((p) => ({ ...p, [g.vendorId]: { methodId: o.methodId, serviceCode: o.serviceCode } }))}
                                style={{ accentColor: theme }}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-semibold" style={{ color: checked ? theme : '#111827' }}>
                                  {o.name}
                                  {o.rateMode === 'LIVE' && <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-500">live</span>}
                                </p>
                                <p className="text-xs text-ink-500">
                                  {o.carrier} · {o.etaMinDays}–{o.etaMaxDays} days
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-ink-900">
                                {o.amount === 0 ? <span style={{ color: '#059669' }}>Free</span> : formatPrice(o.amount, code)}
                              </p>
                            </label>
                          );
                        })}
                        {g.warnings?.map((w) => (
                          <p key={w} className="text-xs text-amber-700">{w}</p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-line flex justify-between gap-3">
              <button onClick={() => setCurrentStep(0)} className="btn-secondary !px-5">Back</button>
              <button onClick={advanceFromShipping} disabled={!allVendorsCovered} className="btn-primary !px-6">Continue to payment</button>
            </div>
          </CheckoutStep>

          <CheckoutStep
            index={3}
            title="Payment"
            isActive={currentStep === 2}
            isComplete={false}
            isLocked={!shippingComplete}
            onEdit={() => setCurrentStep(2)}
            summary={shippingComplete ? (methods.find((m) => m.id === selectedId)?.label ?? 'Choose how to pay') : 'Complete shipping first'}
          >
            <p className="text-xs text-ink-500 mb-3">Choose how you want to pay. The order is placed when you tap the Pay button below.</p>
            <div className="space-y-3">
              {methods.length === 0 ? (
                <p className="text-sm text-ink-500">Loading payment options…</p>
              ) : (
                methods.map((m) => (
                  <PayOption
                    key={m.id}
                    id={`pay-${m.id}`}
                    selected={selectedId === m.id}
                    onSelect={() => setSelectedId(m.id)}
                    theme={theme}
                    icon={<ProviderIcon provider={m.provider} />}
                    title={m.label}
                    subtitle={methodSubtitle(m)}
                  />
                ))
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-line flex justify-between gap-3">
              <button onClick={() => setCurrentStep(1)} className="btn-secondary !px-5">Back</button>
              <button onClick={handlePlace} disabled={loading || !selectedMethod} className="btn-primary !px-6">
                {loading ? 'Processing…' : `Pay ${formatPrice(grand, code)}`}
              </button>
            </div>
          </CheckoutStep>

          {/* Promo code */}
          <section className="bg-surface border border-line rounded-md shadow-card">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Promo code</h2>
              <p className="text-xs text-ink-500 mt-0.5">Got a coupon from {vendor.shopName}? Apply it here.</p>
            </div>
            <div className="p-5 space-y-3">
              {availableCoupons.length > 0 && !coupon && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide font-semibold text-ink-700">Available offers</p>
                  <ul className="space-y-2">
                    {availableCoupons.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 p-3 rounded-md border"
                        style={{ borderColor: `${theme}40`, background: `${theme}08` }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono" style={{ color: theme }}>{c.code}</span>
                            <span className="text-xs text-ink-700">
                              {c.discountType === 'PERCENT'
                                ? `${Number(c.value)}% off${c.maxDiscount ? ` (up to ${formatPrice(Number(c.maxDiscount), code)})` : ''}`
                                : `${formatPrice(Number(c.value), code)} off`}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-500 mt-0.5">
                            {c.scope === 'PRODUCT'
                              ? `On ${c.products.length} selected product${c.products.length === 1 ? '' : 's'}`
                              : 'On all items in this shop'}
                            {c.minOrderAmount ? ` · Min order ${formatPrice(Number(c.minOrderAmount), code)}` : ''}
                            {c.expiresAt ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => applyCouponCode(c.code)}
                          disabled={couponBusy}
                          className="px-3 py-1.5 rounded-pill text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                          style={{ background: theme }}
                        >
                          Use
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {coupon ? (
                <div className="flex items-center justify-between p-3 rounded-md border" style={{ borderColor: `${theme}40`, background: `${theme}10` }}>
                  <div>
                    <p className="text-sm font-semibold font-mono" style={{ color: theme }}>{coupon.code}</p>
                    <p className="text-xs text-ink-700">Discount applied: {formatPrice(coupon.discount, code)}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs hover:underline" style={{ color: '#dc2626' }}>Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1 font-mono uppercase"
                    placeholder="ENTER CODE"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponBusy || !couponInput.trim()}
                    className="px-4 rounded-pill text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                    style={{ background: theme }}
                  >
                    {couponBusy ? 'Applying…' : 'Apply'}
                  </button>
                </div>
              )}
              {couponErr && <p className="text-xs" style={{ color: '#dc2626' }}>{couponErr}</p>}
            </div>
          </section>
        </div>

        {/* Order summary */}
        <aside className="lg:sticky lg:top-32 self-start space-y-4">
          <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Order summary</h2>
            </div>
            <div className="p-5 space-y-3">
              <Row label="Subtotal" value={formatPrice(subtotal, code)} />
              <Row
                label="Shipping"
                value={
                  shipLoading
                    ? '…'
                    : !shipQuote
                      ? 'Enter pincode'
                      : shipping === 0 && allVendorsCovered
                        ? 'Free'
                        : formatPrice(shipping, code)
                }
                valueColor={shipping === 0 && allVendorsCovered ? '#059669' : undefined}
              />
              {coupon && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">
                    Discount
                    <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-mono border rounded-pill px-2 py-0.5" style={{ borderColor: `${theme}60`, background: `${theme}10`, color: theme }}>
                      {coupon.code}
                      <button onClick={removeCoupon} className="hover:opacity-70" aria-label="Remove coupon">×</button>
                    </span>
                  </span>
                  <span className="font-medium" style={{ color: '#059669' }}>−{formatPrice(discount, code)}</span>
                </div>
              )}
              <Row label="Estimated taxes" value="Included" muted />
              <div className="border-t border-line pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-ink-900">Total</span>
                <div className="text-right">
                  <p className="text-2xl font-bold text-ink-900">{formatPrice(grand, code)}</p>
                  <p className="text-xs text-ink-500">incl. of all taxes</p>
                </div>
              </div>

              {err && (
                <div className="rounded-md bg-red-50 border border-red-100 text-sm p-3" style={{ color: '#dc2626' }}>{err}</div>
              )}

              <button
                onClick={handlePlace}
                disabled={loading}
                className="w-full py-3.5 rounded-pill text-white font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: theme }}
              >
                {loading
                  ? 'Processing…'
                  : selectedMethod?.provider === 'RAZORPAY'
                    ? `Pay ${formatPrice(grand, code)}`
                    : `Place order · ${formatPrice(grand, code)}`}
              </button>

              <p className="text-[11px] text-ink-500 text-center pt-1">
                {selectedMethod ? methodSubtitle(selectedMethod) : ''}
              </p>
            </div>
          </div>

          <ul className="space-y-2 px-1">
            {[
              'Free 30-day returns',
              'Hallmarked & certified',
              'Tracked shipping across India',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs text-ink-700">
                <span style={{ color: theme }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {paymentInstructions && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => router.push(`/${storeKey}/orders`)}>
          <div className="bg-surface max-w-md w-full rounded-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-ink-900 mb-1">Order placed</h3>
            <p className="text-sm text-ink-700 mb-4">
              Complete payment using the details below. Your order will be confirmed once {vendor.shopName} verifies receipt.
            </p>
            <div className="bg-canvas border border-line rounded-md p-4 text-sm space-y-2">
              {paymentInstructions.provider === 'UPI_MANUAL' && (
                <>
                  <Row label="Pay to UPI" value={paymentInstructions.data.vpa} />
                  <Row label="Name" value={paymentInstructions.data.displayName} />
                  <Row label="Amount" value={formatPrice(grand, code)} />
                  <Row label="Reference" value={paymentInstructions.orderId.slice(0, 8).toUpperCase()} />
                </>
              )}
              {paymentInstructions.provider === 'BANK_TRANSFER' && (
                <>
                  <Row label="Account holder" value={paymentInstructions.data.accountHolder} />
                  {paymentInstructions.data.bankName && <Row label="Bank" value={paymentInstructions.data.bankName} />}
                  {paymentInstructions.data.ifsc && <Row label="IFSC" value={paymentInstructions.data.ifsc} />}
                  <Row label="Account ending" value={`••${paymentInstructions.data.accountLast4}`} />
                  <Row label="Amount" value={formatPrice(grand, code)} />
                  <Row label="Reference" value={paymentInstructions.orderId.slice(0, 8).toUpperCase()} />
                </>
              )}
            </div>
            <button
              onClick={() => router.push(`/${storeKey}/orders`)}
              className="mt-5 w-full py-3 rounded-pill text-white font-semibold"
              style={{ background: theme }}
            >
              I&apos;ve sent the payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderIcon({ provider }: { provider: VendorPaymentMethod['provider'] }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (provider) {
    case 'RAZORPAY':
      return <svg {...common}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
    case 'UPI_MANUAL':
      return <svg {...common}><path d="M3 12h18" /><path d="M12 3v18" /><circle cx="12" cy="12" r="9" /></svg>;
    case 'BANK_TRANSFER':
      return <svg {...common}><path d="M3 9 12 3l9 6" /><path d="M5 9v10" /><path d="M19 9v10" /><path d="M3 21h18" /></svg>;
    case 'COD':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
  }
}

function PayOption({
  id, selected, onSelect, icon, title, subtitle, theme,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  theme: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-4 p-4 rounded-md border cursor-pointer transition-colors"
      style={selected
        ? { borderColor: theme, background: `${theme}10` }
        : { borderColor: '#e5e7eb', background: '#fff' }}
    >
      <input
        id={id}
        type="radio"
        name="payMethod"
        checked={selected}
        onChange={onSelect}
        style={{ accentColor: theme }}
      />
      <span style={{ color: selected ? theme : '#6b7280' }}>{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: selected ? theme : '#111827' }}>{title}</p>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, muted, valueColor }: { label: string; value: string; muted?: boolean; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-ink-500' : 'text-ink-700'}>{label}</span>
      <span className="font-medium" style={{ color: valueColor ?? '#111827' }}>{value}</span>
    </div>
  );
}
