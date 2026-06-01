'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

const STEPS = [
  { n: 1, title: 'Your shop',         desc: 'Name and pitch' },
  { n: 2, title: 'Business details',  desc: 'PAN, GSTIN, type' },
  { n: 3, title: 'Bank for payouts',  desc: 'Where we send earnings' },
  { n: 4, title: 'Pickup address',    desc: 'Where couriers collect' },
  { n: 5, title: 'Brand your shop',   desc: 'Logo, banner, theme' },
  { n: 6, title: 'Verify identity',   desc: 'Upload ID document' },
] as const;

type Onboarding = {
  vendor: any;
  stepsDone: Record<string, boolean>;
  completed: number;
  total: number;
  nextStep: number;
  submitted: boolean;
  kycStatus: string;
  kycRejectionNote: string | null;
};

export default function SellOnboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<Onboarding | null>(null);
  const [step, setStep] = useState<number>(1);

  async function refresh() {
    const ob = await api<Onboarding>('/api/vendors/me/onboarding');
    setState(ob);
    if (ob.submitted) {
      router.push('/sell/onboard/review');
      return;
    }
    setStep((s) => (s === 1 && ob.nextStep > 1 ? ob.nextStep : s));
  }

  useEffect(() => {
    (async () => {
      try { await refresh(); }
      catch (e: any) {
        if (e.message?.includes('Missing token')) router.push('/sell/login');
        else toast.error(e.message);
      }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line

  if (loading || !state) {
    return <div className="max-w-container mx-auto px-6 py-16"><div className="h-64 bg-surface border border-line rounded-md animate-pulse" /></div>;
  }

  return (
    <div className="max-w-container mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink-900">Set up your shop</h1>
        <p className="text-ink-700 mt-1.5">
          {state.completed} of {state.total} steps complete. Save and resume any time.
        </p>
        <div className="mt-3 h-2 w-full max-w-md rounded-pill bg-canvas overflow-hidden">
          <div className="h-full bg-brand-700 transition-all" style={{ width: `${(state.completed / state.total) * 100}%` }} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <aside className="space-y-1.5">
          {STEPS.map((s) => {
            const done = state.stepsDone[String(s.n)];
            const active = step === s.n;
            return (
              <button
                key={s.n}
                onClick={() => setStep(s.n)}
                className={[
                  'w-full text-left rounded-md border px-3.5 py-2.5 flex items-start gap-3 transition',
                  active ? 'border-brand-700 bg-brand-50' : 'border-line bg-surface hover:border-brand-700/40',
                ].join(' ')}
              >
                <span className={[
                  'h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold',
                  done ? 'bg-success text-white' : active ? 'bg-brand-700 text-white' : 'bg-canvas text-ink-700',
                ].join(' ')}>
                  {done ? '✓' : s.n}
                </span>
                <span>
                  <div className="font-semibold text-sm text-ink-900">{s.title}</div>
                  <div className="text-xs text-ink-500">{s.desc}</div>
                </span>
              </button>
            );
          })}
        </aside>

        <div className="bg-surface border border-line rounded-md p-6 md:p-8">
          {step === 1 && <StepShop vendor={state.vendor} onDone={refresh} />}
          {step === 2 && <StepBusiness vendor={state.vendor} onDone={refresh} />}
          {step === 3 && <StepBank vendor={state.vendor} onDone={refresh} />}
          {step === 4 && <StepAddress vendor={state.vendor} onDone={refresh} />}
          {step === 5 && <StepBranding vendor={state.vendor} onDone={refresh} />}
          {step === 6 && <StepIdAndSubmit vendor={state.vendor} stepsDone={state.stepsDone} onDone={refresh} />}

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-line">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="btn-secondary disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(6, s + 1))}
              disabled={step === 6}
              className="btn-secondary disabled:opacity-40"
            >
              Skip to next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STEP 1 ───────────────────────────────────────────────────────────────────
function StepShop({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const [f, setF] = useState({
    shopName: vendor?.shopName && vendor.shopName !== 'Untitled shop' ? vendor.shopName : '',
    tagline: vendor?.tagline ?? '',
    description: vendor?.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/vendors/onboard/step/1', { method: 'PATCH', body: JSON.stringify(f) });
      toast.success('Shop details saved');
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">Tell us about your shop</h2>
      <Field label="Shop name" required>
        <input className="input-field" required minLength={2} placeholder="e.g. Aanya Fine Jewelry"
          value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} />
      </Field>
      <Field label="Tagline">
        <input className="input-field" maxLength={120} placeholder="Handcrafted silver, made in Jaipur"
          value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
      </Field>
      <Field label="About your shop">
        <textarea className="input-field h-32 py-3" rows={4} maxLength={1000}
          placeholder="Share your craft, materials, and what makes your pieces special."
          value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save & continue'}</button>
    </form>
  );
}

// ── STEP 2 ───────────────────────────────────────────────────────────────────
function StepBusiness({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const [f, setF] = useState({
    businessType: vendor?.businessType ?? 'INDIVIDUAL',
    legalName: vendor?.legalName ?? '',
    panNumber: '',
    gstin: vendor?.gstin ?? '',
  });
  const [busy, setBusy] = useState(false);
  const gstRequired = f.businessType !== 'INDIVIDUAL';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/vendors/onboard/step/2', { method: 'PATCH', body: JSON.stringify(f) });
      toast.success('Business details saved');
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">Business details</h2>
      <p className="text-sm text-ink-700 -mt-2">PAN is stored encrypted. Required by Indian tax law for marketplace sellers.</p>

      <Field label="Business type" required>
        <select className="input-field" value={f.businessType}
          onChange={(e) => setF({ ...f, businessType: e.target.value })}>
          <option value="INDIVIDUAL">Individual / Sole seller</option>
          <option value="PROPRIETORSHIP">Proprietorship</option>
          <option value="PARTNERSHIP">Partnership firm</option>
          <option value="PRIVATE_LIMITED">Private Limited</option>
          <option value="LLP">LLP</option>
        </select>
      </Field>

      <Field label="Legal / registered name" required>
        <input className="input-field" required minLength={2} placeholder="Name as on PAN"
          value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} />
      </Field>

      <Field
        label={vendor?.panNumber ? `PAN (on file: ${vendor.panNumber})` : 'PAN'}
        required={!vendor?.panNumber}
        hint="10 characters, format ABCDE1234F"
      >
        <input className="input-field uppercase" placeholder="ABCDE1234F" maxLength={10}
          pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
          required={!vendor?.panNumber}
          value={f.panNumber} onChange={(e) => setF({ ...f, panNumber: e.target.value.toUpperCase() })} />
      </Field>

      <Field label={`GSTIN${gstRequired ? '' : ' (optional)'}`} required={gstRequired}
        hint={gstRequired ? 'Required for registered businesses' : 'Individuals under the GST threshold may skip'}>
        <input className="input-field uppercase" placeholder="22ABCDE1234F1Z5" maxLength={15}
          required={gstRequired}
          value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
      </Field>

      <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save & continue'}</button>
    </form>
  );
}

// ── STEP 3 ───────────────────────────────────────────────────────────────────
function StepBank({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const [f, setF] = useState({
    bankAccountName: vendor?.bankAccountName ?? '',
    bankAccountNumber: '',
    bankIfsc: vendor?.bankIfsc ?? '',
  });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/vendors/onboard/step/3', { method: 'PATCH', body: JSON.stringify(f) });
      toast.success('Bank details saved');
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">Bank account for payouts</h2>
      <p className="text-sm text-ink-700 -mt-2">Payouts run weekly to this account. Account number is stored encrypted.</p>

      <Field label="Account holder name" required>
        <input className="input-field" required minLength={2}
          value={f.bankAccountName} onChange={(e) => setF({ ...f, bankAccountName: e.target.value })} />
      </Field>
      <Field
        label={vendor?.bankAccountNumber ? `Account number (on file: ${vendor.bankAccountNumber})` : 'Account number'}
        required={!vendor?.bankAccountNumber}
      >
        <input className="input-field" inputMode="numeric" pattern="[0-9]{9,18}"
          placeholder="9–18 digit account number"
          required={!vendor?.bankAccountNumber}
          value={f.bankAccountNumber} onChange={(e) => setF({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <Field label="IFSC code" required hint="11 characters, format ABCD0123456">
        <input className="input-field uppercase" required maxLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}"
          placeholder="HDFC0001234"
          value={f.bankIfsc} onChange={(e) => setF({ ...f, bankIfsc: e.target.value.toUpperCase() })} />
      </Field>
      <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save & continue'}</button>
    </form>
  );
}

// ── STEP 4 ───────────────────────────────────────────────────────────────────
function StepAddress({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const a = vendor?.pickupAddress;
  const [f, setF] = useState({
    contactName: a?.contactName ?? '',
    phone: a?.phone ?? '',
    line1: a?.line1 ?? '',
    line2: a?.line2 ?? '',
    city: a?.city ?? '',
    state: a?.state ?? '',
    postalCode: a?.postalCode ?? '',
    country: a?.country ?? 'IN',
  });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/vendors/onboard/step/4', { method: 'PATCH', body: JSON.stringify(f) });
      toast.success('Pickup address saved');
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">Pickup address</h2>
      <p className="text-sm text-ink-700 -mt-2">Where couriers will collect orders. Also used for returns.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Contact name" required>
          <input className="input-field" required value={f.contactName}
            onChange={(e) => setF({ ...f, contactName: e.target.value })} />
        </Field>
        <Field label="Phone" required>
          <input className="input-field" required inputMode="numeric" value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
      </div>
      <Field label="Address line 1" required>
        <input className="input-field" required value={f.line1}
          onChange={(e) => setF({ ...f, line1: e.target.value })} />
      </Field>
      <Field label="Address line 2">
        <input className="input-field" value={f.line2}
          onChange={(e) => setF({ ...f, line2: e.target.value })} />
      </Field>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="City" required>
          <input className="input-field" required value={f.city}
            onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
        <Field label="State" required>
          <input className="input-field" required value={f.state}
            onChange={(e) => setF({ ...f, state: e.target.value })} />
        </Field>
        <Field label="PIN code" required>
          <input className="input-field" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            value={f.postalCode}
            onChange={(e) => setF({ ...f, postalCode: e.target.value.replace(/\D/g, '') })} />
        </Field>
      </div>
      <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save & continue'}</button>
    </form>
  );
}

// ── STEP 5 ───────────────────────────────────────────────────────────────────
function StepBranding({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const [themeColor, setThemeColor] = useState(vendor?.themeColor ?? '#F1641E');
  const [logo, setLogo] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('themeColor', themeColor);
      if (logo) fd.append('logo', logo);
      if (banner) fd.append('banner', banner);
      await api('/api/vendors/onboard/step/5', { method: 'PATCH', body: fd as any, headers: {} as any });
      toast.success('Branding saved');
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">Brand your shop</h2>
      <p className="text-sm text-ink-700 -mt-2">Optional now — you can refine this later under Settings.</p>

      <Field label="Logo">
        <div className="flex items-center gap-4">
          {vendor?.shopLogoUrl && <img src={vendor.shopLogoUrl} alt="" className="h-16 w-16 rounded-md object-cover border border-line" />}
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
        </div>
      </Field>
      <Field label="Banner" hint="Wide image shown on your storefront (up to 5 total — adds to gallery)">
        <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Theme color">
        <div className="flex items-center gap-3">
          <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)}
            className="h-10 w-16 rounded border border-line" />
          <span className="text-sm text-ink-700 font-mono">{themeColor}</span>
        </div>
      </Field>
      <button disabled={busy} className="btn-primary">{busy ? 'Uploading…' : 'Save & continue'}</button>
    </form>
  );
}

// ── STEP 6 ───────────────────────────────────────────────────────────────────
function StepIdAndSubmit({ vendor, stepsDone, onDone }: { vendor: any; stepsDone: Record<string, boolean>; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const blockers = useMemo(() => {
    const m: string[] = [];
    if (!stepsDone['1']) m.push('Shop details');
    if (!stepsDone['2']) m.push('Business details (PAN)');
    if (!stepsDone['3']) m.push('Bank account');
    if (!stepsDone['4']) m.push('Pickup address');
    return m;
  }, [stepsDone]);

  async function uploadId(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error('Please choose a file');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('idDocument', file);
      await api('/api/vendors/onboard/step/6', { method: 'PATCH', body: fd as any, headers: {} as any });
      toast.success('ID uploaded');
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      await api('/api/vendors/onboard/submit', { method: 'POST', body: JSON.stringify({}) });
      toast.success('Submitted for review!');
      router.push('/sell/onboard/review');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">Verify your identity</h2>
      <p className="text-sm text-ink-700 -mt-2">
        Upload a clear photo of your PAN card or Aadhaar. Our team reviews KYC within 24–48 hours.
      </p>

      <form onSubmit={uploadId} className="space-y-4">
        <Field label="ID document" required hint="JPG, PNG, or PDF — up to 10 MB">
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {vendor?.idDocumentUrl && (
            <p className="text-xs text-success mt-1.5">✓ Document on file. Upload again to replace.</p>
          )}
        </Field>
        <button disabled={busy || !file} className="btn-secondary">{busy ? 'Uploading…' : 'Upload document'}</button>
      </form>

      <div className="border-t border-line pt-5">
        {blockers.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-sm text-ink-900">Complete these first:</p>
            <ul className="text-sm text-ink-700 mt-1.5 list-disc pl-5">
              {blockers.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        ) : !vendor?.idDocumentUrl ? (
          <p className="text-sm text-ink-700">Upload your ID document to submit for review.</p>
        ) : (
          <button onClick={submit} disabled={busy} className="btn-primary !py-3 !px-6">
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Shared field wrapper ─────────────────────────────────────────────────────
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">
        {label}{required && <span className="text-danger ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-ink-500 mt-1">{hint}</span>}
    </label>
  );
}
