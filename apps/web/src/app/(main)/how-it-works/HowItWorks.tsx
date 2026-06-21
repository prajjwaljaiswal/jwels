'use client';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';

// Bilingual seller journey for the vendor marketing site. Language comes from the
// site-wide context (toggle lives in the header). Styles are scoped under `.hiw`.

type T = { en: string; hi: string };
type Step = { t: T; d: T };

const HERO = {
  eyebrow: { en: `Vrindaonline · sell your jewellery online`, hi: `Vrindaonline · अपनी ज्वेलरी ऑनलाइन बेचें` },
  h1: { en: `Open your <em>own jewellery store</em>, step by step.`, hi: `अपना <em>खुद का ज्वेलरी स्टोर</em>, कदम-दर-कदम खोलें।` },
  p: {
    en: `From signing up to your first sale — here's exactly how selling on Vrindaonline works. No code, no monthly fee, and a web address that's truly yours.`,
    hi: `साइन अप से लेकर पहली बिक्री तक — Vrindaonline पर बेचना बिलकुल ऐसे काम करता है। कोई कोड नहीं, कोई मासिक शुल्क नहीं, और एक वेब एड्रेस जो सच में आपका अपना हो।`,
  },
  cta: { en: `Start selling — free`, hi: `बेचना शुरू करें — मुफ़्त` },
};

const STEPS: Step[] = [
  {
    t: { en: `Apply`, hi: `आवेदन करें` },
    d: { en: `Create your seller account and tell us about your brand and the jewellery you make. It takes a few minutes.`,
         hi: `अपना सेलर अकाउंट बनाएं और हमें अपने ब्रांड और अपनी बनाई ज्वेलरी के बारे में बताएं। बस कुछ मिनट लगते हैं।` },
  },
  {
    t: { en: `Get verified`, hi: `वेरिफ़ाई हों` },
    d: { en: `A quick, one-time KYC (PAN, bank, a few sample pieces) keeps the platform trustworthy. We review within 24–48 hours.`,
         hi: `एक बार की त्वरित KYC (PAN, बैंक, कुछ सैंपल पीस) प्लेटफ़ॉर्म को भरोसेमंद रखती है। हम 24–48 घंटों में समीक्षा कर देते हैं।` },
  },
  {
    t: { en: `Design your shop`, hi: `अपना स्टोर डिज़ाइन करें` },
    d: { en: `Choose a theme, add your logo, products and story. <span class="hl">No code, no developer</span> — just point, click and publish.`,
         hi: `एक थीम चुनें, अपना लोगो, प्रोडक्ट्स और कहानी जोड़ें। <span class="hl">कोई कोड नहीं, कोई डेवलपर नहीं</span> — बस क्लिक करें और पब्लिश कर दें।` },
  },
  {
    t: { en: `Claim your address`, hi: `अपना वेब एड्रेस लें` },
    d: { en: `Get a branded address like <code>yourshop.store.vrindaonline.com</code> instantly — or connect your own domain like <code>yourbrand.com</code>. We set up the SSL for you.`,
         hi: `तुरंत एक ब्रांडेड एड्रेस पाएं, जैसे <code>yourshop.store.vrindaonline.com</code> — या अपना खुद का डोमेन जोड़ें जैसे <code>yourbrand.com</code>। SSL हम सेट कर देते हैं।` },
  },
  {
    t: { en: `Sell & get paid`, hi: `बेचें और भुगतान पाएं` },
    d: { en: `Manage every order from one dashboard. A flat 10% applies only when you sell, and payouts settle to your bank every week.`,
         hi: `हर ऑर्डर को एक ही डैशबोर्ड से संभालें। सिर्फ़ बिक्री होने पर 10% लगता है, और कमाई हर हफ़्ते आपके बैंक में आती है।` },
  },
];

const CLOSE = {
  h2: { en: `Ready to open your shop?`, hi: `अपना स्टोर खोलने के लिए तैयार हैं?` },
  p: { en: `It's free to start — you only pay when you make a sale.`, hi: `शुरू करना मुफ़्त है — आप तभी भुगतान करते हैं जब आप बेचते हैं।` },
  cta: { en: `Start selling`, hi: `बेचना शुरू करें` },
};

const CSS = `
.hiw { --ground:#fbf6f0; --surface:#fff; --text:#2a2024; --muted:#6f635b; --line:#ece1d5; --coral:#e65a1a;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:var(--ground); color:var(--text); font-family:var(--sans); line-height:1.6; }
.hiw .wrap { max-width:720px; margin:0 auto; padding:0 22px; }
.hiw[lang="hi"] h1, .hiw[lang="hi"] h2, .hiw[lang="hi"] h3 { font-family:"Tiro Devanagari Hindi","Noto Serif Devanagari",var(--serif); }

.hiw .langbar { display:flex; justify-content:flex-end; padding-top:18px; }
.hiw .lang { display:inline-flex; border:1px solid var(--line); border-radius:999px; overflow:hidden; background:var(--surface); }
.hiw .lang button { font-family:var(--sans); font-size:13px; font-weight:600; border:0; background:transparent; color:var(--muted); padding:6px 14px; cursor:pointer; line-height:1.4; }
.hiw .lang button.on { background:var(--coral); color:#fff; }
.hiw .lang button:focus-visible { outline:2px solid var(--coral); outline-offset:2px; }

.hiw .eyebrow { font-size:12px; letter-spacing:.24em; text-transform:uppercase; color:var(--coral); font-weight:600; }
.hiw .hero { padding:34px 0 44px; text-align:center; }
.hiw .hero .eyebrow { margin-bottom:20px; }
.hiw .hero h1 { font-family:var(--serif); font-size:clamp(32px,5.5vw,52px); line-height:1.07; font-weight:600; letter-spacing:-.01em; margin:0 auto 20px; max-width:18ch; }
.hiw .hero h1 em { font-style:italic; color:var(--coral); }
.hiw .hero p { font-size:clamp(16px,2.2vw,19px); color:var(--muted); max-width:54ch; margin:0 auto 26px; }
.hiw .cta { display:inline-flex; align-items:center; gap:8px; background:var(--coral); color:#fff; font-weight:600; font-size:15px; text-decoration:none; border-radius:999px; padding:12px 26px; transition:transform .15s ease, background .15s ease; }
.hiw .cta:hover { transform:translateY(-2px); background:#cf4d12; }

.hiw .thread { position:relative; margin-top:8px; }
.hiw .thread::before { content:""; position:absolute; left:21px; top:26px; bottom:26px; width:2px; background:var(--coral); opacity:.28; }
.hiw .bead-step { position:relative; display:grid; grid-template-columns:44px 1fr; gap:18px; align-items:start; padding:13px 0; }
.hiw .bead { position:relative; z-index:1; width:44px; height:44px; border-radius:999px; background:radial-gradient(circle at 33% 30%,rgba(255,255,255,.55),rgba(255,255,255,0) 45%),var(--coral); color:#fff; font-family:var(--serif); font-size:18px; font-weight:600; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(42,32,36,.14),inset 0 0 0 1px rgba(255,255,255,.25); }
.hiw .bead-body { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:15px 18px; transition:transform .15s ease,box-shadow .15s ease; }
.hiw .bead-body:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(42,32,36,.07); }
.hiw .bead-body h3 { font-family:var(--serif); font-size:19px; font-weight:600; margin:0 0 4px; }
.hiw .bead-body p { margin:0; color:var(--muted); font-size:14.5px; }
.hiw .bead-body .hl { color:var(--text); font-weight:600; }
.hiw .bead-body code { font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace; font-size:12.5px; background:var(--ground); border:1px solid var(--line); border-radius:5px; padding:1px 6px; color:var(--text); }

.hiw .meet { margin:44px 0 64px; text-align:center; background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:40px 28px; }
.hiw .meet h2 { font-family:var(--serif); font-weight:600; font-size:clamp(24px,4vw,32px); margin:0 0 8px; }
.hiw .meet p { color:var(--muted); max-width:46ch; margin:0 auto 22px; font-size:16px; }
`;

export default function HowItWorks() {
  const { lang } = useLang();
  const L = (o: T) => o[lang];
  const html = (o: T) => ({ __html: o[lang] });

  return (
    <div className="hiw" lang={lang}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wrap">
        <section className="hero">
          <div className="eyebrow">{L(HERO.eyebrow)}</div>
          <h1 dangerouslySetInnerHTML={html(HERO.h1)} />
          <p dangerouslySetInnerHTML={html(HERO.p)} />
          <Link href="/sell/register" className="cta">{L(HERO.cta)}</Link>
        </section>

        <div className="thread">
          {STEPS.map((s, i) => (
            <div className="bead-step" key={i}>
              <div className="bead">{i + 1}</div>
              <div className="bead-body">
                <h3>{L(s.t)}</h3>
                <p dangerouslySetInnerHTML={html(s.d)} />
              </div>
            </div>
          ))}
        </div>

        <section className="meet">
          <h2>{L(CLOSE.h2)}</h2>
          <p>{L(CLOSE.p)}</p>
          <Link href="/sell/register" className="cta">{L(CLOSE.cta)}</Link>
        </section>
      </div>
    </div>
  );
}
