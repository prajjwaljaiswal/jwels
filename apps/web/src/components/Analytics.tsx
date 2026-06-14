'use client';
import Script from 'next/script';

// GA4 + Meta Pixel, loaded only when their measurement IDs are configured via env
// (NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_META_PIXEL_ID). Safe to ship unconfigured —
// renders nothing. Use the `track()` helper to fire funnel events.
const GA4 = process.env.NEXT_PUBLIC_GA4_ID;
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function Analytics() {
  return (
    <>
      {GA4 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4}');`}
          </Script>
        </>
      )}
      {PIXEL && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

type EventParams = Record<string, unknown>;

/** Fire a funnel event to GA4 + Meta Pixel (no-op if not configured). */
export function track(event: string, params: EventParams = {}) {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (typeof w.gtag === 'function') w.gtag('event', event, params);
  if (typeof w.fbq === 'function') {
    const pixelMap: Record<string, string> = {
      add_to_cart: 'AddToCart',
      begin_checkout: 'InitiateCheckout',
      purchase: 'Purchase',
      view_item: 'ViewContent',
    };
    const std = pixelMap[event];
    if (std) w.fbq('track', std, params);
    else w.fbq('trackCustom', event, params);
  }
}
