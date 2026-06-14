'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';
import { useCurrency, CURRENCIES, type CurrencyCode } from '@/lib/currency';

// ── Types ────────────────────────────────────────────────────────────────────

interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface VendorProfile {
  shopName: string;
  slug: string | null;
  tagline: string | null;
  description: string | null;
  address: string | null;
  themeColor: string | null;
  customDomain: string | null;
  shopLogoUrl: string | null;
  theme: any | null;
  businessType: string | null;
  legalName: string | null;
  panNumber: string | null;
  gstin: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  kycStatus: string;
  status: string;
  pickupAddress: PickupAddress | null;
}

interface PickupAddress {
  contactName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

type Tab = 'account' | 'shop' | 'business' | 'bank' | 'address' | 'preferences';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'account',
    label: 'Account',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    id: 'shop',
    label: 'Shop profile',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'business',
    label: 'Business & KYC',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  {
    id: 'bank',
    label: 'Bank details',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'address',
    label: 'Pickup address',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
      </svg>
    ),
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    ),
  },
];

const KYC_BADGE: Record<string, { label: string; cls: string }> = {
  NOT_SUBMITTED: { label: 'Not submitted', cls: 'bg-canvas text-ink-500 border border-line' },
  UNDER_REVIEW:  { label: 'Under review',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  APPROVED:      { label: 'Approved',       cls: 'bg-emerald-50 text-success border border-emerald-200' },
  REJECTED:      { label: 'Rejected',       cls: 'bg-red-50 text-danger border border-red-200' },
};

// ── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-500 mt-1">{hint}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VendorSettingsPage() {
  const [tab, setTab] = useState<Tab>('account');
  const [me, setMe] = useState<Me | null>(null);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [meData, vendorData] = await Promise.all([
        api<Me>('/api/auth/me'),
        api<any>('/api/vendors/me/onboarding'),
      ]);
      setMe(meData);
      setVendor(vendorData.vendor);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, shop profile, business info, and payout details."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface border border-line rounded-md animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Sidebar tabs */}
          <nav className="w-48 shrink-0 bg-surface border border-line rounded-md overflow-hidden shadow-card">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left transition-colors border-l-2 ${
                  tab === t.id
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                    : 'border-transparent text-ink-700 hover:bg-canvas'
                }`}
              >
                <span className={tab === t.id ? 'text-brand-600' : 'text-ink-400'}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 min-w-0">
            {tab === 'account' && me && <AccountTab me={me} onSaved={load} />}
            {tab === 'shop' && vendor && <ShopTab vendor={vendor} onSaved={load} />}
            {tab === 'business' && vendor && <BusinessTab vendor={vendor} onSaved={load} />}
            {tab === 'bank' && vendor && <BankTab vendor={vendor} onSaved={load} />}
            {tab === 'address' && vendor && <AddressTab vendor={vendor} onSaved={load} />}
            {tab === 'preferences' && <PreferencesTab />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Account ──────────────────────────────────────────────────────────────

function AccountTab({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [saving, setSaving] = useState(false);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error('Name must be at least 2 characters');
    setSaving(true);
    try {
      await api('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }) });
      toast.success('Profile updated');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 6) return toast.error('New password must be at least 6 characters');
    if (newPw !== confirmPw) return toast.error('Passwords do not match');
    setChangingPw(true);
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
      toast.success('Password changed');
      setCurPw(''); setNewPw(''); setConfirmPw('');
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-semibold text-ink-900 mb-4">Personal information</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Full name">
            <input className="input-field" value={name} maxLength={80}
              onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email address" hint="Email cannot be changed. Contact support if needed.">
            <input className="input-field bg-canvas text-ink-500 cursor-not-allowed" value={me.email} readOnly />
          </Field>
          <Field label="Phone number" hint="Used for order notifications and support.">
            <input className="input-field" value={phone} maxLength={20} placeholder="+91 98765 43210"
              onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <div className="pt-1">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-ink-900 mb-1">Change password</h2>
        <p className="text-xs text-ink-500 mb-4">Choose a strong password with at least 6 characters.</p>
        <form onSubmit={changePassword} className="space-y-4">
          <Field label="Current password">
            <input type="password" className="input-field" value={curPw}
              onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <input type="password" className="input-field" value={newPw}
              onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <input type="password" className="input-field" value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <div className="pt-1">
            <button type="submit" disabled={changingPw || !curPw || !newPw || !confirmPw} className="btn-primary">
              {changingPw ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Tab: Shop Profile ─────────────────────────────────────────────────────────

function ShopTab({ vendor, onSaved }: { vendor: VendorProfile; onSaved: () => void }) {
  const [form, setForm] = useState({
    shopName:     vendor.shopName ?? '',
    slug:         vendor.slug ?? '',
    tagline:      vendor.tagline ?? '',
    description:  vendor.description ?? '',
    address:      vendor.address ?? '',
    themeColor:   vendor.themeColor ?? '#4F46E5',
    customDomain: vendor.customDomain ?? '',
    logoHeight:   String(vendor.theme?.header?.logoHeight ?? 48),
    logoMaxWidth: String(vendor.theme?.header?.logoMaxWidth ?? 200),
    animEnabled:  String(vendor.theme?.animations?.enabled ?? true),
    animStyle:    vendor.theme?.animations?.style ?? 'fade-up',
    animSpeed:    vendor.theme?.animations?.speed ?? 'normal',
    animStagger:  String(vendor.theme?.animations?.stagger ?? true),
    animHover:    String(vendor.theme?.animations?.hover ?? true),
  });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  function patch(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.shopName.trim().length < 2) return toast.error('Shop name must be at least 2 characters');
    setSaving(true);
    try {
      // Preserve the rest of the theme; only override logo sizing here. The
      // favicon URL is set server-side from the uploaded file.
      const baseTheme = (vendor.theme ?? {}) as Record<string, any>;
      const theme = {
        ...baseTheme,
        header: {
          ...(baseTheme.header ?? {}),
          logoHeight:   Number(form.logoHeight) || 48,
          logoMaxWidth: Number(form.logoMaxWidth) || 200,
        },
        animations: {
          ...(baseTheme.animations ?? {}),
          enabled: form.animEnabled === 'true',
          style:   form.animStyle,
          speed:   form.animSpeed,
          stagger: form.animStagger === 'true',
          hover:   form.animHover === 'true',
        },
      };

      const fd = new FormData();
      fd.append('shopName', form.shopName.trim());
      if (form.slug.trim())         fd.append('slug', form.slug.trim());
      if (form.tagline.trim())      fd.append('tagline', form.tagline.trim());
      if (form.description.trim())  fd.append('description', form.description.trim());
      if (form.address.trim())      fd.append('address', form.address.trim());
      if (form.themeColor)          fd.append('themeColor', form.themeColor);
      if (form.customDomain.trim()) fd.append('customDomain', form.customDomain.trim());
      fd.append('theme', JSON.stringify(theme));
      if (logoFile)    fd.append('logo', logoFile);
      if (faviconFile) fd.append('favicon', faviconFile);

      await api('/api/vendors/me/settings', { method: 'PATCH', body: fd });
      toast.success('Shop profile saved');
      setLogoFile(null);
      setFaviconFile(null);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-ink-900 mb-4">Shop profile</h2>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Shop name">
            <input className="input-field" value={form.shopName} maxLength={60}
              onChange={(e) => patch('shopName', e.target.value)} />
          </Field>
          <Field label="URL handle (slug)" hint={`vrindaonline.com/store/${form.slug || 'your-shop'}`}>
            <input className="input-field font-mono" value={form.slug} maxLength={60}
              placeholder="your-shop-name"
              onChange={(e) => patch('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </Field>
        </div>

        <Field label="Tagline" hint="Short phrase shown under your shop name. Max 120 chars.">
          <input className="input-field" value={form.tagline} maxLength={120}
            placeholder="Handcrafted jewellery for every occasion"
            onChange={(e) => patch('tagline', e.target.value)} />
        </Field>

        <Field label="Shop description" hint={`${form.description.length}/1000 — Shown on your storefront About section.`}>
          <textarea className="input-field min-h-[100px] resize-y" value={form.description} maxLength={1000}
            placeholder="Tell buyers what makes your shop unique, your craft story, materials you use…"
            onChange={(e) => patch('description', e.target.value)} />
        </Field>

        <Field label="Business address" hint="Used on invoices and packing slips. Not shown publicly.">
          <input className="input-field" value={form.address} maxLength={300}
            placeholder="123 Main St, City, State 400001"
            onChange={(e) => patch('address', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Brand colour" hint="Accent colour shown on your storefront.">
            <div className="flex gap-2 items-center">
              <input type="color" className="h-10 w-12 rounded border border-line p-0.5 cursor-pointer"
                value={form.themeColor}
                onChange={(e) => patch('themeColor', e.target.value)} />
              <input className="input-field font-mono flex-1" value={form.themeColor} maxLength={7}
                onChange={(e) => patch('themeColor', e.target.value)} />
            </div>
          </Field>
          <Field label="Custom domain (optional)" hint="e.g. shop.yourbrand.com — requires DNS setup.">
            <input className="input-field font-mono" value={form.customDomain} maxLength={253}
              placeholder="shop.yourbrand.com"
              onChange={(e) => patch('customDomain', e.target.value.toLowerCase())} />
          </Field>
        </div>

        {/* ── Logo & favicon ──────────────────────────────────────────── */}
        <div className="border-t border-line pt-4 mt-2">
          <h3 className="font-semibold text-ink-900 mb-1">Logo &amp; favicon</h3>
          <p className="text-xs text-ink-500 mb-4">Your logo shows in the storefront header (no frame — exactly as uploaded). The favicon is the small icon in the browser tab.</p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Store logo" hint="PNG/SVG with transparent background works best.">
              <div className="flex items-center gap-3">
                {(logoFile || vendor.shopLogoUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoFile ? URL.createObjectURL(logoFile) : vendor.shopLogoUrl!}
                    alt="Logo preview"
                    className="h-12 w-auto max-w-[120px] object-contain border border-line rounded"
                  />
                )}
                <input type="file" accept="image/*" className="text-sm"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
              </div>
            </Field>

            <Field label="Favicon" hint="Square image (e.g. 64×64 or 512×512). Shown in the browser tab.">
              <div className="flex items-center gap-3">
                {(faviconFile || vendor.theme?.faviconUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={faviconFile ? URL.createObjectURL(faviconFile) : vendor.theme.faviconUrl}
                    alt="Favicon preview"
                    className="h-10 w-10 object-contain border border-line rounded"
                  />
                )}
                <input type="file" accept="image/*" className="text-sm"
                  onChange={(e) => setFaviconFile(e.target.files?.[0] ?? null)} />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Logo height (px)" hint="How tall the logo renders in the header. 24–120 is typical.">
              <input type="number" min={16} max={200} className="input-field" value={form.logoHeight}
                onChange={(e) => patch('logoHeight', e.target.value)} />
            </Field>
            <Field label="Logo max width (px)" hint="Caps the logo width so wide logos don't overflow. Width stays auto.">
              <input type="number" min={40} max={600} className="input-field" value={form.logoMaxWidth}
                onChange={(e) => patch('logoMaxWidth', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* ── Animations ──────────────────────────────────────────────── */}
        <div className="border-t border-line pt-4 mt-2">
          <h3 className="font-semibold text-ink-900 mb-1">Animations</h3>
          <p className="text-xs text-ink-500 mb-4">Controls how sections animate into view on your storefront. Respects “reduced motion” device settings.</p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Scroll animations">
              <select className="input-field" value={form.animEnabled} onChange={(e) => patch('animEnabled', e.target.value)}>
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </Field>
            <Field label="Hover zoom (cards)">
              <select className="input-field" value={form.animHover} onChange={(e) => patch('animHover', e.target.value)}>
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <Field label="Style">
              <select className="input-field" value={form.animStyle} onChange={(e) => patch('animStyle', e.target.value)} disabled={form.animEnabled !== 'true'}>
                <option value="fade">Fade</option>
                <option value="fade-up">Fade up</option>
                <option value="left">Slide left</option>
                <option value="right">Slide right</option>
                <option value="zoom">Zoom</option>
              </select>
            </Field>
            <Field label="Speed">
              <select className="input-field" value={form.animSpeed} onChange={(e) => patch('animSpeed', e.target.value)} disabled={form.animEnabled !== 'true'}>
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </Field>
            <Field label="Stagger sections">
              <select className="input-field" value={form.animStagger} onChange={(e) => patch('animStagger', e.target.value)} disabled={form.animEnabled !== 'true'}>
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="pt-1">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save shop profile'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ── Tab: Business & KYC ───────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'INDIVIDUAL',      label: 'Individual / Sole trader' },
  { value: 'PROPRIETORSHIP',  label: 'Proprietorship' },
  { value: 'PARTNERSHIP',     label: 'Partnership' },
  { value: 'PRIVATE_LIMITED', label: 'Private Limited (Pvt. Ltd.)' },
  { value: 'LLP',             label: 'LLP' },
];

function BusinessTab({ vendor, onSaved }: { vendor: VendorProfile; onSaved: () => void }) {
  const [form, setForm] = useState({
    businessType: vendor.businessType ?? 'INDIVIDUAL',
    legalName:    vendor.legalName ?? '',
    panNumber:    '',
    gstin:        vendor.gstin ?? '',
  });
  const [saving, setSaving] = useState(false);
  const kycBadge = KYC_BADGE[vendor.kycStatus] ?? KYC_BADGE.NOT_SUBMITTED;

  function patch(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.legalName.trim()) return toast.error('Legal name is required');
    if (!form.panNumber.trim()) return toast.error('PAN number is required');
    setSaving(true);
    try {
      await api('/api/vendors/onboard/step/2', {
        method: 'PATCH',
        body: JSON.stringify({
          businessType: form.businessType,
          legalName:    form.legalName.trim(),
          panNumber:    form.panNumber.trim().toUpperCase(),
          gstin:        form.gstin.trim().toUpperCase() || undefined,
        }),
      });
      toast.success('Business info saved');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-ink-900">Business & KYC</h2>
        <span className={`text-xs px-2.5 py-1 rounded-pill font-semibold ${kycBadge.cls}`}>
          {kycBadge.label}
        </span>
      </div>

      {vendor.kycStatus === 'APPROVED' && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Your KYC is approved. Contact support to update business or PAN details.
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        <Field label="Business type">
          <select className="input-field" value={form.businessType}
            onChange={(e) => patch('businessType', e.target.value)}
            disabled={vendor.kycStatus === 'APPROVED'}>
            {BUSINESS_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Legal / registered name" hint="Exactly as it appears on your PAN card.">
          <input className="input-field" value={form.legalName} maxLength={120}
            placeholder="Full legal name"
            disabled={vendor.kycStatus === 'APPROVED'}
            onChange={(e) => patch('legalName', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="PAN number" hint={vendor.panNumber ? `Current: ${vendor.panNumber} — enter new to update` : 'Format: ABCDE1234F'}>
            <input className="input-field font-mono uppercase" value={form.panNumber} maxLength={10}
              placeholder={vendor.panNumber ? '••••••••••' : 'ABCDE1234F'}
              disabled={vendor.kycStatus === 'APPROVED'}
              onChange={(e) => patch('panNumber', e.target.value.toUpperCase())} />
          </Field>
          <Field label={`GSTIN ${form.businessType === 'INDIVIDUAL' ? '(optional)' : '(required)'}`} hint="15-digit GST Identification Number.">
            <input className="input-field font-mono uppercase" value={form.gstin} maxLength={15}
              placeholder="22ABCDE1234F1Z5"
              disabled={vendor.kycStatus === 'APPROVED'}
              onChange={(e) => patch('gstin', e.target.value.toUpperCase())} />
          </Field>
        </div>

        {vendor.kycStatus !== 'APPROVED' && (
          <div className="pt-1">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save business info'}
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}

// ── Tab: Bank Details ─────────────────────────────────────────────────────────

function BankTab({ vendor, onSaved }: { vendor: VendorProfile; onSaved: () => void }) {
  const [form, setForm] = useState({
    bankAccountName:   vendor.bankAccountName ?? '',
    bankAccountNumber: '',
    bankIfsc:          vendor.bankIfsc ?? '',
  });
  const [saving, setSaving] = useState(false);

  function patch(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bankAccountName.trim()) return toast.error('Account holder name is required');
    if (!form.bankAccountNumber.trim()) return toast.error('Account number is required');
    if (!form.bankIfsc.trim()) return toast.error('IFSC code is required');
    setSaving(true);
    try {
      await api('/api/vendors/onboard/step/3', {
        method: 'PATCH',
        body: JSON.stringify({
          bankAccountName:   form.bankAccountName.trim(),
          bankAccountNumber: form.bankAccountNumber.trim(),
          bankIfsc:          form.bankIfsc.trim().toUpperCase(),
        }),
      });
      toast.success('Bank details saved');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-ink-900 mb-1">Bank details</h2>
      <p className="text-xs text-ink-500 mb-4">Payouts are transferred to this account weekly. Account number is stored encrypted.</p>

      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Account details are encrypted and only visible to the finance team for payout processing.
      </div>

      <form onSubmit={save} className="space-y-4">
        <Field label="Account holder name" hint="Must match the name on your bank account.">
          <input className="input-field" value={form.bankAccountName} maxLength={120}
            placeholder="Full name as on bank account"
            onChange={(e) => patch('bankAccountName', e.target.value)} />
        </Field>

        <Field label="Account number" hint={vendor.bankAccountNumber ? `Current: ${vendor.bankAccountNumber} — enter new to update` : '9–18 digit account number'}>
          <input className="input-field font-mono" value={form.bankAccountNumber} maxLength={18}
            placeholder={vendor.bankAccountNumber ? '••••••••••' : '0123456789'}
            onChange={(e) => patch('bankAccountNumber', e.target.value.replace(/\D/g, ''))} />
        </Field>

        <Field label="IFSC code" hint="11-character code from your cheque book or bank passbook.">
          <input className="input-field font-mono uppercase" value={form.bankIfsc} maxLength={11}
            placeholder="SBIN0001234"
            onChange={(e) => patch('bankIfsc', e.target.value.toUpperCase())} />
        </Field>

        <div className="pt-1">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save bank details'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ── Tab: Preferences ─────────────────────────────────────────────────────────

const CURRENCY_DESCRIPTIONS: Record<CurrencyCode, string> = {
  INR: 'Indian Rupee — prices shown in ₹',
  USD: 'US Dollar — prices shown in $',
  GBP: 'British Pound — prices shown in £',
  EUR: 'Euro — prices shown in €',
  AED: 'UAE Dirham — prices shown in د.إ',
};

function PreferencesTab() {
  const { code, setCode } = useCurrency();

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-ink-900 mb-1">Display preferences</h2>
      <p className="text-xs text-ink-500 mb-5">
        These settings affect how prices are displayed across the dashboard and storefront.
        Prices are stored in INR — this is a display-only conversion.
      </p>

      <div>
        <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-3">Currency</p>
        <div className="space-y-2">
          {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([c, { symbol }]) => (
            <label
              key={c}
              className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                code === c
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-line bg-surface hover:bg-canvas'
              }`}
            >
              <input
                type="radio"
                name="currency"
                className="accent-brand-600"
                checked={code === c}
                onChange={() => setCode(c)}
              />
              <span className="text-xl w-8 text-center">{symbol}</span>
              <div>
                <p className="text-sm font-semibold text-ink-900">{c}</p>
                <p className="text-xs text-ink-500">{CURRENCY_DESCRIPTIONS[c]}</p>
              </div>
              {code === c && (
                <span className="ml-auto text-xs font-semibold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-pill">
                  Active
                </span>
              )}
            </label>
          ))}
        </div>
        <p className="text-[11px] text-ink-500 mt-3">
          Your preference is saved in your browser. Switching devices will reset to INR.
        </p>
      </div>
    </Card>
  );
}

// ── Tab: Pickup Address ───────────────────────────────────────────────────────

function AddressTab({ vendor, onSaved }: { vendor: VendorProfile; onSaved: () => void }) {
  const addr = vendor.pickupAddress;
  const [form, setForm] = useState({
    contactName: addr?.contactName ?? '',
    phone:       addr?.phone ?? '',
    line1:       addr?.line1 ?? '',
    line2:       addr?.line2 ?? '',
    city:        addr?.city ?? '',
    state:       addr?.state ?? '',
    postalCode:  addr?.postalCode ?? '',
    country:     addr?.country ?? 'IN',
  });
  const [saving, setSaving] = useState(false);

  function patch(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const required: [keyof typeof form, string][] = [
      ['contactName', 'Contact name'],
      ['phone', 'Phone'],
      ['line1', 'Address line 1'],
      ['city', 'City'],
      ['state', 'State'],
      ['postalCode', 'Postal code'],
    ];
    for (const [key, label] of required) {
      if (!form[key].trim()) return toast.error(`${label} is required`);
    }
    setSaving(true);
    try {
      await api('/api/vendors/onboard/step/4', {
        method: 'PATCH',
        body: JSON.stringify({
          contactName: form.contactName.trim(),
          phone:       form.phone.trim(),
          line1:       form.line1.trim(),
          line2:       form.line2.trim() || undefined,
          city:        form.city.trim(),
          state:       form.state.trim(),
          postalCode:  form.postalCode.trim(),
          country:     form.country.trim() || 'IN',
        }),
      });
      toast.success('Pickup address saved');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-ink-900 mb-1">Pickup address</h2>
      <p className="text-xs text-ink-500 mb-4">The address where couriers will pick up your orders for shipping.</p>

      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact name">
            <input className="input-field" value={form.contactName} maxLength={80}
              placeholder="Name of person available for pickup"
              onChange={(e) => patch('contactName', e.target.value)} />
          </Field>
          <Field label="Contact phone">
            <input className="input-field" value={form.phone} maxLength={20}
              placeholder="+91 98765 43210"
              onChange={(e) => patch('phone', e.target.value)} />
          </Field>
        </div>

        <Field label="Address line 1">
          <input className="input-field" value={form.line1} maxLength={200}
            placeholder="House/flat no., street name"
            onChange={(e) => patch('line1', e.target.value)} />
        </Field>

        <Field label="Address line 2 (optional)">
          <input className="input-field" value={form.line2} maxLength={200}
            placeholder="Area, landmark"
            onChange={(e) => patch('line2', e.target.value)} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="City">
            <input className="input-field" value={form.city} maxLength={80}
              onChange={(e) => patch('city', e.target.value)} />
          </Field>
          <Field label="State">
            <input className="input-field" value={form.state} maxLength={80}
              onChange={(e) => patch('state', e.target.value)} />
          </Field>
          <Field label="Postal code">
            <input className="input-field" value={form.postalCode} maxLength={12}
              onChange={(e) => patch('postalCode', e.target.value)} />
          </Field>
        </div>

        <Field label="Country" hint="ISO 2-letter country code.">
          <input className="input-field font-mono uppercase w-24" value={form.country} maxLength={2}
            onChange={(e) => patch('country', e.target.value.toUpperCase())} />
        </Field>

        <div className="pt-1">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save address'}
          </button>
        </div>
      </form>
    </Card>
  );
}
