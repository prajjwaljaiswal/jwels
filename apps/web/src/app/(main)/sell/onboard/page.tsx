'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';

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
  const { t } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<Onboarding | null>(null);
  const [step, setStep] = useState<number>(1);

  const STEP_LABELS: Record<number, { title: string; desc: string }> = {
    1: { title: t('Your shop', 'आपकी दुकान'), desc: t('Name and pitch', 'नाम और परिचय') },
    2: { title: t('Business details', 'व्यापार विवरण'), desc: t('PAN, GSTIN, type', 'पैन, जीएसटीआईएन, प्रकार') },
    3: { title: t('Bank for payouts', 'भुगतान के लिए बैंक'), desc: t('Where we send earnings', 'जहाँ हम कमाई भेजते हैं') },
    4: { title: t('Pickup address', 'पिकअप पता'), desc: t('Where couriers collect', 'जहाँ से कूरियर सामान लेता है') },
    5: { title: t('Brand your shop', 'अपनी दुकान को सजाएँ'), desc: t('Logo, banner, theme', 'लोगो, बैनर, थीम') },
    6: { title: t('Verify identity', 'पहचान सत्यापित करें'), desc: t('Upload ID document', 'पहचान दस्तावेज़ अपलोड करें') },
  };

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
        <h1 className="font-display text-3xl text-ink-900">{t('Set up your shop', 'अपनी दुकान सेट करें')}</h1>
        <p className="text-ink-700 mt-1.5">
          {state.completed} / {state.total} {t('steps complete. Save and resume any time.', 'चरण पूरे। कभी भी सहेजें और फिर से शुरू करें।')}
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
                  <div className="font-semibold text-sm text-ink-900">{STEP_LABELS[s.n].title}</div>
                  <div className="text-xs text-ink-500">{STEP_LABELS[s.n].desc}</div>
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
              ← {t('Back', 'पीछे')}
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(6, s + 1))}
              disabled={step === 6}
              className="btn-secondary disabled:opacity-40"
            >
              {t('Skip to next', 'अगले पर जाएँ')} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STEP 1 ───────────────────────────────────────────────────────────────────
function StepShop({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const { t } = useLang();
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
      toast.success(t('Shop details saved', 'दुकान विवरण सहेजा गया'));
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">{t('Tell us about your shop', 'अपनी दुकान के बारे में बताएँ')}</h2>
      <Field label={t('Shop name', 'दुकान का नाम')} required>
        <input className="input-field" required minLength={2} placeholder={t('e.g. Aanya Fine Jewelry', 'जैसे आन्या फाइन ज्वेलरी')}
          value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} />
      </Field>
      <Field label={t('Tagline', 'टैगलाइन')}>
        <input className="input-field" maxLength={120} placeholder={t('Handcrafted silver, made in Jaipur', 'हस्तनिर्मित चाँदी, जयपुर में बनी')}
          value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
      </Field>
      <Field label={t('About your shop', 'आपकी दुकान के बारे में')}>
        <textarea className="input-field h-32 py-3" rows={4} maxLength={1000}
          placeholder={t('Share your craft, materials, and what makes your pieces special.', 'अपनी कारीगरी, सामग्री और अपने आभूषणों की खासियत बताएँ।')}
          value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <button disabled={busy} className="btn-primary">{busy ? t('Saving…', 'सहेज रहे हैं…') : t('Save & continue', 'सहेजें और आगे बढ़ें')}</button>
    </form>
  );
}

// ── STEP 2 ───────────────────────────────────────────────────────────────────
function StepBusiness({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const { t } = useLang();
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
      toast.success(t('Business details saved', 'व्यापार विवरण सहेजा गया'));
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">{t('Business details', 'व्यापार विवरण')}</h2>
      <p className="text-sm text-ink-700 -mt-2">{t('PAN is stored encrypted. Required by Indian tax law for marketplace sellers.', 'पैन एन्क्रिप्टेड रूप में सुरक्षित रहता है। मार्केटप्लेस विक्रेताओं के लिए भारतीय कर कानून के तहत आवश्यक।')}</p>

      <Field label={t('Business type', 'व्यापार का प्रकार')} required>
        <select className="input-field" value={f.businessType}
          onChange={(e) => setF({ ...f, businessType: e.target.value })}>
          <option value="INDIVIDUAL">{t('Individual / Sole seller', 'व्यक्तिगत / एकल विक्रेता')}</option>
          <option value="PROPRIETORSHIP">{t('Proprietorship', 'प्रोप्राइटरशिप')}</option>
          <option value="PARTNERSHIP">{t('Partnership firm', 'पार्टनरशिप फर्म')}</option>
          <option value="PRIVATE_LIMITED">{t('Private Limited', 'प्राइवेट लिमिटेड')}</option>
          <option value="LLP">{t('LLP', 'एलएलपी')}</option>
        </select>
      </Field>

      <Field label={t('Legal / registered name', 'कानूनी / पंजीकृत नाम')} required>
        <input className="input-field" required minLength={2} placeholder={t('Name as on PAN', 'पैन पर दर्ज नाम')}
          value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} />
      </Field>

      <Field
        label={vendor?.panNumber ? `${t('PAN (on file:', 'पैन (दर्ज:')} ${vendor.panNumber})` : t('PAN', 'पैन')}
        required={!vendor?.panNumber}
        hint={t('10 characters, format ABCDE1234F', '10 अक्षर, प्रारूप ABCDE1234F')}
      >
        <input className="input-field uppercase" placeholder="ABCDE1234F" maxLength={10}
          pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
          required={!vendor?.panNumber}
          value={f.panNumber} onChange={(e) => setF({ ...f, panNumber: e.target.value.toUpperCase() })} />
      </Field>

      <Field label={`${t('GSTIN', 'जीएसटीआईएन')}${gstRequired ? '' : ` ${t('(optional)', '(वैकल्पिक)')}`}`} required={gstRequired}
        hint={gstRequired ? t('Required for registered businesses', 'पंजीकृत व्यवसायों के लिए आवश्यक') : t('Individuals under the GST threshold may skip', 'जीएसटी सीमा से कम वाले व्यक्ति इसे छोड़ सकते हैं')}>
        <input className="input-field uppercase" placeholder="22ABCDE1234F1Z5" maxLength={15}
          required={gstRequired}
          value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
      </Field>

      <button disabled={busy} className="btn-primary">{busy ? t('Saving…', 'सहेज रहे हैं…') : t('Save & continue', 'सहेजें और आगे बढ़ें')}</button>
    </form>
  );
}

// ── STEP 3 ───────────────────────────────────────────────────────────────────
function StepBank({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const { t } = useLang();
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
      toast.success(t('Bank details saved', 'बैंक विवरण सहेजा गया'));
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">{t('Bank account for payouts', 'भुगतान के लिए बैंक खाता')}</h2>
      <p className="text-sm text-ink-700 -mt-2">{t('Payouts run weekly to this account. Account number is stored encrypted.', 'भुगतान हर हफ़्ते इसी खाते में होता है। खाता संख्या एन्क्रिप्टेड रूप में सुरक्षित रहती है।')}</p>

      <Field label={t('Account holder name', 'खाताधारक का नाम')} required>
        <input className="input-field" required minLength={2}
          value={f.bankAccountName} onChange={(e) => setF({ ...f, bankAccountName: e.target.value })} />
      </Field>
      <Field
        label={vendor?.bankAccountNumber ? `${t('Account number (on file:', 'खाता संख्या (दर्ज:')} ${vendor.bankAccountNumber})` : t('Account number', 'खाता संख्या')}
        required={!vendor?.bankAccountNumber}
      >
        <input className="input-field" inputMode="numeric" pattern="[0-9]{9,18}"
          placeholder={t('9–18 digit account number', '9–18 अंकों की खाता संख्या')}
          required={!vendor?.bankAccountNumber}
          value={f.bankAccountNumber} onChange={(e) => setF({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <Field label={t('IFSC code', 'आईएफएससी कोड')} required hint={t('11 characters, format ABCD0123456', '11 अक्षर, प्रारूप ABCD0123456')}>
        <input className="input-field uppercase" required maxLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}"
          placeholder="HDFC0001234"
          value={f.bankIfsc} onChange={(e) => setF({ ...f, bankIfsc: e.target.value.toUpperCase() })} />
      </Field>
      <button disabled={busy} className="btn-primary">{busy ? t('Saving…', 'सहेज रहे हैं…') : t('Save & continue', 'सहेजें और आगे बढ़ें')}</button>
    </form>
  );
}

// ── STEP 4 ───────────────────────────────────────────────────────────────────
function StepAddress({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const { t } = useLang();
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
      toast.success(t('Pickup address saved', 'पिकअप पता सहेजा गया'));
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">{t('Pickup address', 'पिकअप पता')}</h2>
      <p className="text-sm text-ink-700 -mt-2">{t('Where couriers will collect orders. Also used for returns.', 'जहाँ से कूरियर ऑर्डर लेगा। वापसी के लिए भी यही पता इस्तेमाल होगा।')}</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t('Contact name', 'संपर्क नाम')} required>
          <input className="input-field" required value={f.contactName}
            onChange={(e) => setF({ ...f, contactName: e.target.value })} />
        </Field>
        <Field label={t('Phone', 'फ़ोन')} required>
          <input className="input-field" required inputMode="numeric" value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Address line 1', 'पता पंक्ति 1')} required>
        <input className="input-field" required value={f.line1}
          onChange={(e) => setF({ ...f, line1: e.target.value })} />
      </Field>
      <Field label={t('Address line 2', 'पता पंक्ति 2')}>
        <input className="input-field" value={f.line2}
          onChange={(e) => setF({ ...f, line2: e.target.value })} />
      </Field>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label={t('City', 'शहर')} required>
          <input className="input-field" required value={f.city}
            onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
        <Field label={t('State', 'राज्य')} required>
          <input className="input-field" required value={f.state}
            onChange={(e) => setF({ ...f, state: e.target.value })} />
        </Field>
        <Field label={t('PIN code', 'पिन कोड')} required>
          <input className="input-field" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            value={f.postalCode}
            onChange={(e) => setF({ ...f, postalCode: e.target.value.replace(/\D/g, '') })} />
        </Field>
      </div>
      <button disabled={busy} className="btn-primary">{busy ? t('Saving…', 'सहेज रहे हैं…') : t('Save & continue', 'सहेजें और आगे बढ़ें')}</button>
    </form>
  );
}

// ── STEP 5 ───────────────────────────────────────────────────────────────────
function StepBranding({ vendor, onDone }: { vendor: any; onDone: () => void }) {
  const { t } = useLang();
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
      toast.success(t('Branding saved', 'ब्रांडिंग सहेजी गई'));
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">{t('Brand your shop', 'अपनी दुकान को सजाएँ')}</h2>
      <p className="text-sm text-ink-700 -mt-2">{t('Optional now — you can refine this later under Settings.', 'अभी वैकल्पिक — आप इसे बाद में सेटिंग्स में बदल सकते हैं।')}</p>

      <Field label={t('Logo', 'लोगो')}>
        <div className="flex items-center gap-4">
          {vendor?.shopLogoUrl && <img src={vendor.shopLogoUrl} alt={t('Shop logo', 'दुकान का लोगो')} className="h-16 w-16 rounded-md object-cover border border-line" />}
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
        </div>
      </Field>
      <Field label={t('Banner', 'बैनर')} hint={t('Wide image shown on your storefront (up to 5 total — adds to gallery)', 'आपकी दुकान पर दिखने वाली चौड़ी छवि (अधिकतम 5 — गैलरी में जुड़ती है)')}>
        <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label={t('Theme color', 'थीम रंग')}>
        <div className="flex items-center gap-3">
          <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)}
            className="h-10 w-16 rounded border border-line" />
          <span className="text-sm text-ink-700 font-mono">{themeColor}</span>
        </div>
      </Field>
      <button disabled={busy} className="btn-primary">{busy ? t('Uploading…', 'अपलोड हो रहा है…') : t('Save & continue', 'सहेजें और आगे बढ़ें')}</button>
    </form>
  );
}

// ── STEP 6 ───────────────────────────────────────────────────────────────────
function StepIdAndSubmit({ vendor, stepsDone, onDone }: { vendor: any; stepsDone: Record<string, boolean>; onDone: () => void }) {
  const { t } = useLang();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const blockers = useMemo(() => {
    const m: string[] = [];
    if (!stepsDone['1']) m.push(t('Shop details', 'दुकान विवरण'));
    if (!stepsDone['2']) m.push(t('Business details (PAN)', 'व्यापार विवरण (पैन)'));
    if (!stepsDone['3']) m.push(t('Bank account', 'बैंक खाता'));
    if (!stepsDone['4']) m.push(t('Pickup address', 'पिकअप पता'));
    return m;
  }, [stepsDone, t]);

  async function uploadId(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error(t('Please choose a file', 'कृपया एक फ़ाइल चुनें'));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('idDocument', file);
      await api('/api/vendors/onboard/step/6', { method: 'PATCH', body: fd as any, headers: {} as any });
      toast.success(t('ID uploaded', 'पहचान दस्तावेज़ अपलोड हुआ'));
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      await api('/api/vendors/onboard/submit', { method: 'POST', body: JSON.stringify({}) });
      toast.success(t('Submitted for review!', 'समीक्षा के लिए भेज दिया गया!'));
      router.push('/sell/onboard/review');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl text-ink-900">{t('Verify your identity', 'अपनी पहचान सत्यापित करें')}</h2>
      <p className="text-sm text-ink-700 -mt-2">
        {t('Upload a clear photo of your PAN card or Aadhaar. Our team reviews KYC within 24–48 hours.', 'अपने पैन कार्ड या आधार की साफ़ फ़ोटो अपलोड करें। हमारी टीम 24–48 घंटों में केवाईसी की समीक्षा करती है।')}
      </p>

      <form onSubmit={uploadId} className="space-y-4">
        <Field label={t('ID document', 'पहचान दस्तावेज़')} required hint={t('JPG, PNG, or PDF — up to 10 MB', 'JPG, PNG या PDF — अधिकतम 10 MB')}>
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {vendor?.idDocumentUrl && (
            <p className="text-xs text-success mt-1.5">{t('✓ Document on file. Upload again to replace.', '✓ दस्तावेज़ दर्ज है। बदलने के लिए फिर से अपलोड करें।')}</p>
          )}
        </Field>
        <button disabled={busy || !file} className="btn-secondary">{busy ? t('Uploading…', 'अपलोड हो रहा है…') : t('Upload document', 'दस्तावेज़ अपलोड करें')}</button>
      </form>

      <div className="border-t border-line pt-5">
        {blockers.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-sm text-ink-900">{t('Complete these first:', 'पहले इन्हें पूरा करें:')}</p>
            <ul className="text-sm text-ink-700 mt-1.5 list-disc pl-5">
              {blockers.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        ) : !vendor?.idDocumentUrl ? (
          <p className="text-sm text-ink-700">{t('Upload your ID document to submit for review.', 'समीक्षा के लिए भेजने हेतु अपना पहचान दस्तावेज़ अपलोड करें।')}</p>
        ) : (
          <button onClick={submit} disabled={busy} className="btn-primary !py-3 !px-6">
            {busy ? t('Submitting…', 'भेजा जा रहा है…') : t('Submit for review', 'समीक्षा के लिए भेजें')}
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
