'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useCart } from '@/lib/cart';
import { useCurrency, formatPrice } from '@/lib/currency';
import { useWishlist } from '@/lib/wishlist';
import { api } from '@/lib/api';
import { addressApi, type Address } from '@/lib/addresses';
import { GuestCheckoutPanel } from '@/components/GuestCheckoutPanel';
import { CheckoutStep } from '@/components/checkout/CheckoutStep';

declare global {
  interface Window { Razorpay: any; }
}

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

export default function CheckoutPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const { items, setQty, remove, total, clear } = useCart();
  const addToWishlist = useWishlist((s) => s.add);

  async function saveForLater(productId: string, variationComboId?: string) {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { toast.error('Sign in to save items for later'); return; }
    await addToWishlist(productId);
    remove(productId, variationComboId);
    toast.success('Moved to wishlist');
  }
  const [addr, setAddr] = useState({ name: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '' });
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new'>('new');
  const [authed, setAuthed] = useState(false);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [makeNewDefault, setMakeNewDefault] = useState(false);
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    setAuthed(typeof window !== 'undefined' && !!window.localStorage.getItem('token'));
  }, []);

  async function refreshAfterAuth() {
    setAuthed(true);
    try {
      const { items } = await addressApi.list();
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
    } catch {}
  }
  const [payMethod, setPayMethod] = useState<'RAZORPAY' | 'COD'>('RAZORPAY');
  const [codEnabled, setCodEnabled] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [shipQuote, setShipQuote] = useState<QuoteGroup[] | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipError, setShipError] = useState('');
  const [shipSel, setShipSel] = useState<Record<string, { methodId: string; serviceCode: string | null }>>({});

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponErr, setCouponErr] = useState('');

  useEffect(() => {
    api<{ enabled: boolean }>('/api/settings/cod', { auth: false })
      .then((r) => setCodEnabled(r.enabled))
      .catch(() => {});

    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
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

  // Refetch quote whenever cart contents OR a usable destination changes.
  useEffect(() => {
    if (items.length === 0) { setShipQuote(null); return; }
    const pinOk = /^\d{6}$/.test(addr.pincode);
    const stateOk = addr.state.trim().length >= 2;
    if (!pinOk || !stateOk) { setShipQuote(null); return; }

    const ctrl = new AbortController();
    setShipLoading(true);
    setShipError('');
    api<{ groups: QuoteGroup[] }>('/api/shipping/quote', {
      method: 'POST',
      auth: false,
      silent: true,
      signal: ctrl.signal,
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
        destination: { postalCode: addr.pincode, state: addr.state, country: 'IN' },
        paymentMode: payMethod === 'COD' ? 'COD' : 'PREPAID',
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
  }, [items, addr.pincode, addr.state, payMethod]);

  // Re-validate any applied coupon whenever cart changes
  useEffect(() => {
    if (!coupon) return;
    if (items.length === 0) { setCoupon(null); return; }
    const vendorId = items[0].vendorId;
    api<{ discount: number; code: string }>('/api/coupons/preview', {
      method: 'POST',
      silent: true,
      body: JSON.stringify({
        code: coupon.code,
        vendorId,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
      }),
    })
      .then((r) => setCoupon({ code: r.code, discount: r.discount }))
      .catch((e: any) => {
        setCoupon(null);
        setCouponErr(e?.message || 'Coupon no longer applies');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function applyCoupon() {
    setCouponErr('');
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (items.length === 0) return;
    setCouponBusy(true);
    try {
      const r = await api<{ discount: number; code: string }>('/api/coupons/preview', {
        method: 'POST',
        silent: true,
        body: JSON.stringify({
          code,
          vendorId: items[0].vendorId,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
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

  function removeCoupon() {
    setCoupon(null);
    setCouponErr('');
  }

  const shippingTotal = shipQuote
    ? shipQuote.reduce((sum, g) => {
        const sel = shipSel[g.vendorId];
        const opt = sel ? g.options.find((o) => o.methodId === sel.methodId && o.serviceCode === sel.serviceCode) : null;
        return sum + (opt?.amount ?? 0);
      }, 0)
    : 0;

  const allVendorsCovered = shipQuote
    ? shipQuote.every((g) => g.options.length === 0 || !!shipSel[g.vendorId])
    : false;

  function selectionsPayload() {
    return Object.entries(shipSel).map(([vendorId, s]) => ({
      vendorId, methodId: s.methodId, serviceCode: s.serviceCode,
    }));
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

  /**
   * If the user is using a new address (not an existing saved one) and asked to
   * save it, persist via /api/addresses and reflect the new entry in local state.
   * Best-effort: failure here doesn't block checkout.
   */
  async function persistNewAddressIfRequested(): Promise<void> {
    if (selectedAddressId !== 'new') return;
    if (!saveNewAddress) return;
    if (!authed) return;
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
      // silently swallow — the order should still proceed
    }
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

  async function placeCOD() {
    setErr('');
    const missing = validateAddr();
    if (missing.length > 0) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    if (!allVendorsCovered) { setErr('Please select a shipping option'); return; }

    setLoading(true);
    try {
      await persistNewAddressIfRequested();
      await api('/api/orders/cod', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
          shippingAddress: addr,
          shippingSelections: selectionsPayload(),
          couponCode: coupon?.code,
        }),
      });
      toast.success('Order placed! You can pay on delivery.');
      clear();
      router.push('/orders');
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  async function payOnline() {
    setErr('');
    const missing = validateAddr();
    if (missing.length > 0) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    if (!allVendorsCovered) { setErr('Please select a shipping option'); return; }

    setLoading(true);
    try {
      await persistNewAddressIfRequested();
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error('Failed to load payment gateway');

      const checkout = await api<{
        orderId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        razorpayKeyId: string;
      }>('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variationComboId: i.variationComboId })),
          shippingAddress: addr,
          shippingSelections: selectionsPayload(),
          couponCode: coupon?.code,
        }),
      });

      const rzp = new window.Razorpay({
        key: checkout.razorpayKeyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.razorpayOrderId,
        name: 'Vrindaonline Marketplace',
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
            clear();
            router.push('/orders');
          } catch (e: any) {
            setErr(`Payment verification failed: ${e.message}`);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: '#F1641E' },
      });
      rzp.open();
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }

  function handlePlace() {
    if (payMethod === 'COD') placeCOD();
    else payOnline();
  }

  const subtotal = total();
  const shipping = shippingTotal;
  const discount = coupon?.discount ?? 0;
  const grand = Math.max(0, subtotal + shipping - discount);

  if (items.length === 0) {
    return (
      <div className="max-w-container mx-auto px-6 py-16">
        <div className="max-w-md mx-auto text-center bg-surface border border-line rounded-md shadow-card p-10">
          <div className="inline-flex h-14 w-14 rounded-full bg-brand-50 text-brand-700 items-center justify-center mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="18" cy="20" r="1.5" />
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
            </svg>
          </div>
          <h1 className="font-display text-3xl text-ink-900 mb-2">Your cart is empty</h1>
          <p className="text-ink-700 mb-6">Looks like you haven't added anything yet — let's fix that.</p>
          <Link href="/products" className="btn-primary">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/products" className="hover:text-brand-700">Jewelry</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">Checkout</span>
      </nav>

      <h1 className="font-display text-3xl text-ink-900 mb-2">Checkout</h1>
      {items[0]?.vendorName && (
        <p className="text-sm text-ink-700 mb-6">
          Paying <span className="font-semibold text-ink-900">{items[0].vendorName}</span>
          <span className="text-ink-500"> · each checkout is to a single shop</span>
        </p>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: stepped checkout */}
        <div className="space-y-4">
          {!authed && (
            <GuestCheckoutPanel onContinue={refreshAfterAuth} />
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
                <Link href="/account/addresses" className="text-xs text-brand-700 hover:underline">Manage</Link>
              )}
            </div>
            {savedAddresses.length > 0 && (
              <div className="space-y-2 mb-4">
                {savedAddresses.map((a) => {
                  const sel = selectedAddressId === a.id;
                  return (
                    <label key={a.id} className={`flex gap-3 p-3 rounded-md border cursor-pointer ${sel ? 'border-brand-500 bg-brand-50/40' : 'border-line hover:border-ink-700'}`}>
                      <input type="radio" name="saved-address" checked={sel} onChange={() => selectAddress(a.id)} className="mt-1" />
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
                  <input type="radio" name="saved-address" checked={selectedAddressId === 'new'} onChange={() => selectAddress('new')} className="mt-1" />
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
            <p className="text-xs text-ink-500 mb-3">Pick a delivery option per shop. Live rates load after you fill in pincode and state.</p>
            <div className="space-y-4">
              {!/^\d{6}$/.test(addr.pincode) || addr.state.trim().length < 2 ? (
                <p className="text-sm text-ink-500">Enter your pincode and state above to see shipping options.</p>
              ) : shipLoading ? (
                <p className="text-sm text-ink-500">Loading shipping options…</p>
              ) : shipError ? (
                <p className="text-sm text-danger">{shipError}</p>
              ) : !shipQuote || shipQuote.length === 0 ? (
                <p className="text-sm text-ink-500">No shipping options available.</p>
              ) : (
                <div className="space-y-5">
                  {shipQuote.map((g) => {
                    const cartForVendor = items.filter((i) => i.vendorId === g.vendorId);
                    const vendorName = cartForVendor[0]?.vendorName ?? 'Shop';
                    if (g.options.length === 0) {
                      return (
                        <div key={g.vendorId}>
                          <p className="text-sm font-semibold text-ink-900 mb-1">{vendorName}</p>
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            This shop has no shipping methods to your area. Please contact them or remove their items.
                          </p>
                        </div>
                      );
                    }
                    const sel = shipSel[g.vendorId];
                    return (
                      <div key={g.vendorId}>
                        <p className="text-sm font-semibold text-ink-900 mb-2">{vendorName}</p>
                        <div className="space-y-2">
                          {g.options.map((o) => {
                            const id = `${g.vendorId}-${o.methodId}-${o.serviceCode ?? 'na'}`;
                            const checked = !!sel && sel.methodId === o.methodId && sel.serviceCode === o.serviceCode;
                            return (
                              <label
                                key={id}
                                htmlFor={id}
                                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                                  checked ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400'
                                }`}
                              >
                                <input
                                  id={id}
                                  type="radio"
                                  name={`ship-${g.vendorId}`}
                                  checked={checked}
                                  onChange={() => setShipSel((p) => ({ ...p, [g.vendorId]: { methodId: o.methodId, serviceCode: o.serviceCode } }))}
                                  className="accent-brand-600"
                                />
                                <div className="flex-1">
                                  <p className={`text-sm font-semibold ${checked ? 'text-brand-700' : 'text-ink-900'}`}>
                                    {o.name}
                                    {o.rateMode === 'LIVE' && <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-500">live</span>}
                                  </p>
                                  <p className="text-xs text-ink-500">
                                    {o.carrier} · {o.etaMinDays}–{o.etaMaxDays} days
                                  </p>
                                </div>
                                <p className="text-sm font-semibold text-ink-900">
                                  {o.amount === 0 ? <span className="text-success">Free</span> : formatPrice(o.amount, code)}
                                </p>
                              </label>
                            );
                          })}
                        </div>
                        {g.warnings?.map((w) => (
                          <p key={w} className="text-xs text-amber-700 mt-2">{w}</p>
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
            summary={shippingComplete ? `${payMethod === 'COD' ? 'Cash on Delivery' : 'Pay online'}` : 'Complete shipping first'}
          >
            <p className="text-xs text-ink-500 mb-3">Choose how you want to pay. The order is placed when you tap the Pay button on the right.</p>
            <div className="space-y-3">
              <PayOption
                id="pay-online"
                selected={payMethod === 'RAZORPAY'}
                onSelect={() => setPayMethod('RAZORPAY')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                }
                title="Pay online"
                subtitle="UPI, cards, netbanking via Razorpay"
              />
              {codEnabled && (
                <PayOption
                  id="pay-cod"
                  selected={payMethod === 'COD'}
                  onSelect={() => setPayMethod('COD')}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  }
                  title="Cash on Delivery"
                  subtitle="Pay when your order arrives"
                />
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-line flex justify-between gap-3">
              <button onClick={() => setCurrentStep(1)} className="btn-secondary !px-5">Back</button>
              <button onClick={handlePlace} disabled={loading} className="btn-primary !px-6">
                {loading ? 'Processing…' : payMethod === 'COD' ? `Place order · ${formatPrice(grand, code)}` : `Pay ${formatPrice(grand, code)}`}
              </button>
            </div>
          </CheckoutStep>

          {/* Promo code */}
          <section className="bg-surface border border-line rounded-md shadow-card">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Promo code</h2>
              <p className="text-xs text-ink-500 mt-0.5">Got a coupon? Apply it here.</p>
            </div>
            <div className="p-5 space-y-3">
              {coupon ? (
                <div className="flex items-center justify-between p-3 rounded-md border border-emerald-200 bg-emerald-50">
                  <div>
                    <p className="text-sm font-semibold text-success font-mono">{coupon.code}</p>
                    <p className="text-xs text-ink-700">Discount applied: {formatPrice(coupon.discount, code)}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs text-danger hover:underline">Remove</button>
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
                    className="btn-primary"
                  >
                    {couponBusy ? 'Applying…' : 'Apply'}
                  </button>
                </div>
              )}
              {couponErr && <p className="text-xs text-danger">{couponErr}</p>}
            </div>
          </section>
        </div>

        {/* RIGHT: order summary (sticky) */}
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
                valueClass={shipping === 0 && allVendorsCovered ? 'text-success' : ''}
              />
              {coupon && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">
                    Discount
                    <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-mono bg-emerald-50 text-success border border-emerald-200 rounded-pill px-2 py-0.5">
                      {coupon.code}
                      <button onClick={removeCoupon} className="hover:text-danger" aria-label="Remove coupon">×</button>
                    </span>
                  </span>
                  <span className="font-medium text-success">−{formatPrice(discount, code)}</span>
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
                <div className="rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3">{err}</div>
              )}

              <button onClick={handlePlace} disabled={loading} className="btn-primary w-full !py-3.5 text-base">
                {loading
                  ? 'Processing…'
                  : payMethod === 'COD'
                    ? `Place order · ${formatPrice(grand, code)} COD`
                    : `Pay ${formatPrice(grand, code)}`}
              </button>

              <p className="text-[11px] text-ink-500 text-center pt-1">
                {payMethod === 'COD'
                  ? 'Pay cash when your order is delivered'
                  : 'Secure payments by Razorpay · UPI, cards, netbanking'}
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
                <span className="text-success">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function PayOption({
  id, selected, onSelect, icon, title, subtitle,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-4 p-4 rounded-md border cursor-pointer transition-colors ${
        selected ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400'
      }`}
    >
      <input
        id={id}
        type="radio"
        name="payMethod"
        checked={selected}
        onChange={onSelect}
        className="accent-brand-600"
      />
      <span className={selected ? 'text-brand-700' : 'text-ink-500'}>{icon}</span>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${selected ? 'text-brand-700' : 'text-ink-900'}`}>{title}</p>
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

function Row({ label, value, muted, valueClass = '' }: { label: string; value: string; muted?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-ink-500' : 'text-ink-700'}>{label}</span>
      <span className={`font-medium ${valueClass || 'text-ink-900'}`}>{value}</span>
    </div>
  );
}
