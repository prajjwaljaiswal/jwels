import type {
  CarrierAdapter,
  CarrierContext,
  CreateShipmentInput,
  CreateShipmentResult,
  RateQuote,
  RateQuoteInput,
  TrackingEvent,
  VerifyResult,
} from './types';
import { getCachedToken, setCachedToken, tokenKey } from './tokenCache';

// FedEx Web Services (REST). Uses OAuth client_credentials. Two hosts:
//   TEST: https://apis-sandbox.fedex.com
//   LIVE: https://apis.fedex.com
//
// Endpoints used:
//   POST /oauth/token                           → access_token (3600s TTL)
//   POST /rate/v1/rates/quotes                  → rate quotes
//   POST /track/v1/trackingnumbers              → tracking events

const HOST_TEST = 'https://apis-sandbox.fedex.com';
const HOST_LIVE = 'https://apis.fedex.com';

interface FedexCreds {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
}
interface FedexDefaults {
  accountNumber?: string;
  pickupPincode?: string;
  pickupCountry?: string;
}

function host(ctx: CarrierContext): string {
  return ctx.mode === 'LIVE' ? HOST_LIVE : HOST_TEST;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 8000): Promise<{ status: number; body: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function getToken(ctx: CarrierContext): Promise<string> {
  const creds = ctx.credentials as unknown as FedexCreds;
  if (!creds.clientId || !creds.clientSecret) throw new Error('Missing FedEx clientId/clientSecret');

  const key = tokenKey('FEDEX', ctx.mode, creds as any);
  const cached = getCachedToken(key);
  if (cached) return cached;

  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const { status, body } = await fetchJson(`${host(ctx)}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (status >= 400 || !body?.access_token) {
    throw new Error(body?.errors?.[0]?.message || body?.error_description || 'FedEx auth failed');
  }
  setCachedToken(key, body.access_token, Number(body.expires_in) || 3600);
  return body.access_token as string;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-locale': 'en_US',
  };
}

export const fedex: CarrierAdapter = {
  key: 'FEDEX',
  displayName: 'FedEx',
  category: 'INTERNATIONAL',
  supportedServices: [
    { code: 'FEDEX_GROUND',                  name: 'FedEx Ground',            serviceType: 'STANDARD',  etaMinDays: 3, etaMaxDays: 7 },
    { code: 'FEDEX_EXPRESS_SAVER',           name: 'FedEx Express Saver',     serviceType: 'EXPRESS',   etaMinDays: 2, etaMaxDays: 4 },
    { code: 'FEDEX_INTERNATIONAL_PRIORITY',  name: "FedEx Int'l Priority",    serviceType: 'OVERNIGHT', etaMinDays: 1, etaMaxDays: 3 },
    { code: 'INTERNATIONAL_ECONOMY',         name: 'FedEx Int\'l Economy',    serviceType: 'STANDARD',  etaMinDays: 4, etaMaxDays: 7 },
  ],

  credentialFields: [
    { key: 'clientId',      label: 'API Key (clientId)',     type: 'secret', required: true,
      helpText: 'Create a project on developer.fedex.com to get API credentials.' },
    { key: 'clientSecret',  label: 'Secret Key',             type: 'secret', required: true },
    { key: 'accountNumber', label: 'FedEx account number',   type: 'text',   isDefault: true,
      helpText: 'Required for rate quotes and shipment creation.' },
    { key: 'pickupPincode', label: 'Pickup postal code',     type: 'text',   isDefault: true },
    { key: 'pickupCountry', label: 'Pickup country (ISO-2)', type: 'text',   isDefault: true,
      helpText: 'e.g. IN, US' },
  ],

  async verify(ctx): Promise<VerifyResult> {
    try {
      await getToken(ctx);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Auth failed' };
    }
  },

  async quote(ctx, input: RateQuoteInput): Promise<RateQuote[]> {
    const defaults = (ctx.defaults || {}) as FedexDefaults;
    const account = (ctx.credentials as unknown as FedexCreds).accountNumber || defaults.accountNumber;
    if (!account) return [];
    const fromCountry = (defaults.pickupCountry || 'IN').toUpperCase();
    const toCountry = (input.toCountry || 'IN').toUpperCase();
    const fromPin = (input.fromPostalCode || defaults.pickupPincode || '').trim();
    const toPin = (input.toPostalCode || '').trim();
    if (!fromPin || !toPin) return [];

    const token = await getToken(ctx);
    const payload = {
      accountNumber: { value: account },
      requestedShipment: {
        shipper: { address: { postalCode: fromPin, countryCode: fromCountry } },
        recipient: { address: { postalCode: toPin, countryCode: toCountry } },
        rateRequestType: ['ACCOUNT', 'LIST'],
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        requestedPackageLineItems: [{
          weight: { units: 'KG', value: Math.max(0.1, input.weightGrams / 1000) },
        }],
      },
    };
    const { status, body } = await fetchJson(`${host(ctx)}/rate/v1/rates/quotes`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }, 10000);
    if (status >= 400) return [];

    const details = body?.output?.rateReplyDetails;
    if (!Array.isArray(details)) return [];

    return details
      .map((d: any): RateQuote | null => {
        const sd = d?.ratedShipmentDetails?.[0];
        const total = Number(sd?.totalNetCharge ?? sd?.totalNetFedExCharge ?? 0);
        if (!Number.isFinite(total) || total <= 0) return null;
        const currency = sd?.currency || sd?.shipmentRateDetail?.currency || 'INR';
        const commit = d?.commit;
        const eta = commit?.dateDetail?.dayOfWeek
          ? undefined
          : Number(commit?.transitTime?.replace(/[^\d]/g, '')) || undefined;
        return {
          carrier: 'FEDEX',
          serviceCode: d?.serviceType ?? '',
          serviceName: d?.serviceName ?? d?.serviceType ?? 'FedEx',
          amount: total,
          currency,
          etaMinDays: eta,
          etaMaxDays: eta,
          raw: d,
        };
      })
      .filter((q): q is RateQuote => !!q);
  },

  async createShipment(ctx, input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const defaults = (ctx.defaults || {}) as FedexDefaults;
    const account = (ctx.credentials as unknown as FedexCreds).accountNumber || defaults.accountNumber;
    if (!account) throw new Error('FedEx accountNumber is required to create a shipment');
    const fromCountry = (defaults.pickupCountry || input.fromAddress.country || 'IN').toUpperCase();
    const toCountry = (input.toAddress.country || 'IN').toUpperCase();

    const token = await getToken(ctx);

    const payload = {
      labelResponseOptions: 'URL_ONLY',
      accountNumber: { value: account },
      requestedShipment: {
        shipper: {
          contact: { personName: input.fromAddress.name, phoneNumber: input.fromAddress.phone },
          address: {
            streetLines: [input.fromAddress.line1, input.fromAddress.line2].filter(Boolean),
            city: input.fromAddress.city,
            stateOrProvinceCode: input.fromAddress.state,
            postalCode: input.fromAddress.postalCode,
            countryCode: fromCountry,
          },
        },
        recipients: [{
          contact: { personName: input.toAddress.name, phoneNumber: input.toAddress.phone },
          address: {
            streetLines: [input.toAddress.line1, input.toAddress.line2].filter(Boolean),
            city: input.toAddress.city,
            stateOrProvinceCode: input.toAddress.state,
            postalCode: input.toAddress.postalCode,
            countryCode: toCountry,
          },
        }],
        pickupType: 'USE_SCHEDULED_PICKUP',
        serviceType: input.serviceCode || 'FEDEX_GROUND',
        packagingType: 'YOUR_PACKAGING',
        shippingChargesPayment: {
          paymentType: 'SENDER',
          payor: { responsibleParty: { accountNumber: { value: account } } },
        },
        labelSpecification: {
          imageType: 'PDF',
          labelStockType: 'PAPER_85X11_TOP_HALF_LABEL',
        },
        requestedPackageLineItems: [{
          weight: { units: 'KG', value: Math.max(0.1, input.weightGrams / 1000) },
          declaredValue: { amount: input.declaredValue, currency: 'INR' },
        }],
      },
    };

    const { status, body } = await fetchJson(`${host(ctx)}/ship/v1/shipments`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }, 15000);

    if (status >= 400) {
      const msg = body?.errors?.[0]?.message ?? body?.output?.alerts?.[0]?.message ?? `FedEx responded ${status}`;
      throw new Error(`FedEx shipment failed: ${msg}`);
    }

    const ts = body?.output?.transactionShipments?.[0];
    const awb = ts?.masterTrackingNumber || ts?.completedShipmentDetail?.masterTrackingId?.trackingNumber;
    if (!awb) throw new Error('FedEx did not return a tracking number');

    const labelUrl =
      ts?.pieceResponses?.[0]?.packageDocuments?.[0]?.url ??
      ts?.shipmentDocuments?.[0]?.url ??
      undefined;

    return {
      awb,
      labelUrl,
      trackingUrl: `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(awb)}`,
      raw: body,
    };
  },

  async track(ctx, awb: string): Promise<TrackingEvent[]> {
    const token = await getToken(ctx);
    const payload = {
      includeDetailedScans: true,
      trackingInfo: [{ trackingNumberInfo: { trackingNumber: awb } }],
    };
    const { status, body } = await fetchJson(`${host(ctx)}/track/v1/trackingnumbers`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (status >= 400) return [];
    const tr = body?.output?.completeTrackResults?.[0]?.trackResults?.[0];
    const events = tr?.scanEvents;
    if (!Array.isArray(events)) return [];
    return events.map((e: any): TrackingEvent => ({
      status: e?.eventType ?? e?.derivedStatus ?? 'UPDATE',
      description: e?.eventDescription ?? undefined,
      location: [e?.scanLocation?.city, e?.scanLocation?.stateOrProvinceCode, e?.scanLocation?.countryCode]
        .filter(Boolean).join(', ') || undefined,
      timestamp: e?.date ?? new Date().toISOString(),
    }));
  },
};
