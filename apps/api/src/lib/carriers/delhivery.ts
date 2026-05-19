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

// Delhivery API. Two environments share the same paths; only the host changes.
//   LIVE:    https://track.delhivery.com
//   TEST:    https://staging-express.delhivery.com
// Auth: header `Authorization: Token <api_token>` on all calls.
//
// Endpoints used:
//   GET /c/api/pin-codes/json/?filter_codes={pin}      → pincode serviceability (used as cheap verify)
//   GET /api/kinko/v1/invoice/charges/.json            → rate calculator
//     params: md=S|E, ss=Delivered, d_pin, o_pin, cgm (grams), pt=Pre-paid|COD, cod=<value>

const HOST_LIVE = 'https://track.delhivery.com';
const HOST_TEST = 'https://staging-express.delhivery.com';

interface DelhiveryCreds {
  apiToken: string;
  clientName?: string;
}

interface DelhiveryDefaults {
  pickupPincode?: string;
}

function host(ctx: CarrierContext): string {
  return ctx.mode === 'LIVE' ? HOST_LIVE : HOST_TEST;
}

function authHeaders(ctx: CarrierContext): Record<string, string> {
  const { apiToken } = ctx.credentials as unknown as DelhiveryCreds;
  return {
    Authorization: `Token ${apiToken}`,
    Accept: 'application/json',
  };
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 8000): Promise<{ status: number; body: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

export const delhivery: CarrierAdapter = {
  key: 'DELHIVERY',
  displayName: 'Delhivery',

  credentialFields: [
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'secret',
      required: true,
      helpText: 'Found in the Delhivery dashboard under API → Settings.',
    },
    {
      key: 'clientName',
      label: 'Client Name',
      type: 'text',
      required: false,
      helpText: 'Registered client/warehouse name on Delhivery.',
    },
    {
      key: 'pickupPincode',
      label: 'Pickup Pincode',
      type: 'text',
      required: true,
      isDefault: true,
      helpText: 'Default origin pincode used for rate quotes.',
    },
  ],

  async verify(ctx): Promise<VerifyResult> {
    const creds = ctx.credentials as unknown as DelhiveryCreds;
    const defaults = (ctx.defaults || {}) as DelhiveryDefaults;
    if (!creds?.apiToken) return { ok: false, message: 'Missing API token' };

    // Use pincode serviceability as a cheap auth check. If pickupPincode is provided
    // we look it up; otherwise fall back to a known servicable pin (110001 — New Delhi).
    const pin = (defaults.pickupPincode || '110001').replace(/\D/g, '');
    const url = `${host(ctx)}/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pin)}`;
    try {
      const { status, body } = await fetchJson(url, { headers: authHeaders(ctx) });
      if (status === 401 || status === 403) {
        return { ok: false, message: 'Invalid API token' };
      }
      if (status >= 400) {
        return { ok: false, message: `Delhivery responded ${status}` };
      }
      const data = body?.delivery_codes;
      if (Array.isArray(data) && data.length > 0) {
        return { ok: true };
      }
      // Auth was accepted but the pincode is not serviceable — still a valid token.
      return { ok: true, message: 'Token OK; pickup pincode not serviceable' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Network error' };
    }
  },

  async quote(ctx, input: RateQuoteInput): Promise<RateQuote[]> {
    const defaults = (ctx.defaults || {}) as DelhiveryDefaults;
    const origin = (input.fromPostalCode || defaults.pickupPincode || '').replace(/\D/g, '');
    const dest = (input.toPostalCode || '').replace(/\D/g, '');
    if (!origin || !dest) {
      throw new Error('Delhivery quote requires both origin and destination pincodes');
    }
    const weight = Math.max(1, Math.round(input.weightGrams)); // grams
    const pt = input.paymentMode === 'COD' ? 'COD' : 'Pre-paid';
    const cod = input.paymentMode === 'COD' ? input.declaredValue : 0;

    // Quote both Surface (S) and Express (E); ignore failures of either.
    const services: { code: 'S' | 'E'; name: string; etaMin: number; etaMax: number }[] = [
      { code: 'S', name: 'Surface', etaMin: 3, etaMax: 6 },
      { code: 'E', name: 'Express', etaMin: 1, etaMax: 3 },
    ];

    const results: RateQuote[] = [];
    await Promise.all(services.map(async (svc) => {
      const params = new URLSearchParams({
        md: svc.code,
        ss: 'Delivered',
        o_pin: origin,
        d_pin: dest,
        cgm: String(weight),
        pt,
        cod: String(cod),
      });
      const url = `${host(ctx)}/api/kinko/v1/invoice/charges/.json?${params.toString()}`;
      try {
        const { status, body } = await fetchJson(url, { headers: authHeaders(ctx) });
        if (status >= 400) return;
        // Response shape: array of objects with `total_amount` (or nested in different
        // historical versions). Be defensive about both shapes.
        const row = Array.isArray(body) ? body[0] : body?.[0] ?? body;
        const amount = Number(
          row?.total_amount ?? row?.gross_amount ?? row?.charge_DL ?? 0,
        );
        if (!Number.isFinite(amount) || amount <= 0) return;
        results.push({
          carrier: 'DELHIVERY',
          serviceCode: svc.code,
          serviceName: svc.name,
          amount,
          currency: 'INR',
          etaMinDays: svc.etaMin,
          etaMaxDays: svc.etaMax,
          raw: row,
        });
      } catch {
        // swallow per-service errors; caller can fall back to flat methods
      }
    }));
    return results;
  },

  async createShipment(ctx, input: CreateShipmentInput): Promise<CreateShipmentResult> {
    // Delhivery's manifest endpoint. Body is x-www-form-urlencoded with two fields:
    //   format=json
    //   data=<json with pickup_location + shipments[]>
    // The shipment object: name, add, city, state, country, pin, phone, order, payment_mode, total_amount, cod_amount, weight.
    const creds = ctx.credentials as { apiToken: string; clientName?: string };
    const defaults = (ctx.defaults || {}) as { pickupPincode?: string };
    if (!creds.apiToken) throw new Error('Missing Delhivery API token');

    const shipment = {
      name: input.toAddress.name,
      add: [input.toAddress.line1, input.toAddress.line2].filter(Boolean).join(', '),
      city: input.toAddress.city,
      state: input.toAddress.state,
      country: input.toAddress.country || 'India',
      pin: input.toPostalCode.replace(/\D/g, ''),
      phone: input.toAddress.phone,
      order: input.orderRef,
      payment_mode: input.paymentMode === 'COD' ? 'COD' : 'Prepaid',
      total_amount: input.declaredValue,
      cod_amount: input.paymentMode === 'COD' ? input.declaredValue : 0,
      weight: Math.max(1, Math.round(input.weightGrams)),
      shipment_height: 5,
      shipment_width: 10,
      shipment_length: 15,
      products_desc: 'Jewellery',
    };

    const payload = {
      pickup_location: { name: creds.clientName || 'default' },
      shipments: [shipment],
    };
    const body = new URLSearchParams({ format: 'json', data: JSON.stringify(payload) });

    const url = `${host(ctx)}/api/cmu/create.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders(ctx),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    if (!res.ok) {
      const msg = data?.rmk || data?.error || `Delhivery responded ${res.status}`;
      throw new Error(`Delhivery shipment failed: ${msg}`);
    }
    // Successful response: { packages: [{ waybill, ... }], success: true }
    const pkg = data?.packages?.[0];
    const awb = pkg?.waybill;
    if (!awb) {
      throw new Error('Delhivery did not return a waybill');
    }

    return {
      awb,
      // Delhivery label/manifest is fetched via a separate endpoint with the AWB:
      labelUrl: `${host(ctx)}/api/p/packing_slip?wbns=${awb}&pdf=true`,
      trackingUrl: `https://www.delhivery.com/track/package/${awb}`,
      raw: data,
    };
  },

  async track(ctx, awb: string): Promise<TrackingEvent[]> {
    const url = `${host(ctx)}/api/v1/packages/json/?waybill=${encodeURIComponent(awb)}`;
    const { status, body } = await fetchJson(url, { headers: authHeaders(ctx) });
    if (status >= 400) return [];
    const scans = body?.ShipmentData?.[0]?.Shipment?.Scans ?? [];
    if (!Array.isArray(scans)) return [];
    return scans.map((s: any): TrackingEvent => {
      const detail = s?.ScanDetail ?? s;
      return {
        status: detail?.Scan ?? detail?.ScanType ?? 'UPDATE',
        description: detail?.Instructions ?? detail?.StatusType ?? undefined,
        location: detail?.ScannedLocation ?? undefined,
        timestamp: detail?.ScanDateTime ?? new Date().toISOString(),
      };
    });
  },
};
