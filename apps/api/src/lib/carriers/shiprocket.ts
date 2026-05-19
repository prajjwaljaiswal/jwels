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

// Shiprocket aggregator. Single login covers Delhivery, Bluedart, DTDC, Ekart,
// FedEx-via-Shiprocket, etc. Endpoints (no test/live host distinction at the API
// layer — `mode` is for the vendor's own bookkeeping):
//
//   POST /v1/external/auth/login                          → { token } (10-day TTL)
//   GET  /v1/external/courier/serviceability/?...         → array of courier_company quotes
//   POST /v1/external/orders/create/adhoc                 → creates order, returns shipment_id, order_id
//   POST /v1/external/courier/assign/awb                  → assigns AWB to shipment
//   GET  /v1/external/courier/track/awb/{awb}             → tracking events
//   GET  /v1/external/courier/generate/label?shipment_id= → label PDF URL

const HOST = 'https://apiv2.shiprocket.in';

interface SrCreds {
  email: string;
  password: string;
}
interface SrDefaults {
  pickupPincode?: string;
  pickupLocation?: string; // registered Shiprocket pickup name
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

async function login(ctx: CarrierContext): Promise<string> {
  const creds = ctx.credentials as unknown as SrCreds;
  const key = tokenKey('SHIPROCKET', ctx.mode, creds as any);
  const cached = getCachedToken(key);
  if (cached) return cached;

  const { status, body } = await fetchJson(`${HOST}/v1/external/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  if (status >= 400 || !body?.token) {
    throw new Error(body?.message || 'Shiprocket login failed');
  }
  // Token TTL is ~10 days; cache for 8 to leave headroom.
  setCachedToken(key, body.token, 8 * 24 * 3600);
  return body.token as string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const shiprocket: CarrierAdapter = {
  key: 'SHIPROCKET',
  displayName: 'Shiprocket',

  credentialFields: [
    { key: 'email',          label: 'Shiprocket email',    type: 'text',   required: true },
    { key: 'password',       label: 'Shiprocket password', type: 'secret', required: true,
      helpText: 'Recommended: create a dedicated API user and use that password.' },
    { key: 'pickupPincode',  label: 'Pickup pincode',      type: 'text',   required: true, isDefault: true },
    { key: 'pickupLocation', label: 'Pickup location name',type: 'text',   isDefault: true,
      helpText: 'Exact name of the pickup location registered in your Shiprocket account.' },
  ],

  async verify(ctx): Promise<VerifyResult> {
    try {
      await login(ctx);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Login failed' };
    }
  },

  async quote(ctx, input: RateQuoteInput): Promise<RateQuote[]> {
    const defaults = (ctx.defaults || {}) as SrDefaults;
    const origin = (input.fromPostalCode || defaults.pickupPincode || '').replace(/\D/g, '');
    const dest = (input.toPostalCode || '').replace(/\D/g, '');
    if (!origin || !dest) return [];

    const token = await login(ctx);
    const params = new URLSearchParams({
      pickup_postcode: origin,
      delivery_postcode: dest,
      weight: String(Math.max(0.1, input.weightGrams / 1000)), // Shiprocket expects kg
      cod: input.paymentMode === 'COD' ? '1' : '0',
      declared_value: String(input.declaredValue),
    });
    const { status, body } = await fetchJson(
      `${HOST}/v1/external/courier/serviceability/?${params.toString()}`,
      { headers: authHeaders(token) },
    );
    if (status >= 400) return [];
    const couriers = body?.data?.available_courier_companies;
    if (!Array.isArray(couriers)) return [];

    return couriers
      .map((c: any): RateQuote | null => {
        const amount = Number(c?.rate ?? c?.freight_charge ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        const eta = Number(c?.estimated_delivery_days ?? 0);
        return {
          carrier: 'SHIPROCKET',
          serviceCode: String(c?.courier_company_id ?? c?.id ?? ''),
          serviceName: c?.courier_name ?? 'Courier',
          amount,
          currency: 'INR',
          etaMinDays: eta || undefined,
          etaMaxDays: eta ? eta + 1 : undefined,
          raw: c,
        };
      })
      .filter((q): q is RateQuote => !!q);
  },

  async createShipment(ctx, input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const defaults = (ctx.defaults || {}) as SrDefaults;
    const token = await login(ctx);

    // Step 1: create the adhoc order
    const orderPayload = {
      order_id: input.orderRef,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: defaults.pickupLocation || 'default',
      billing_customer_name: input.toAddress.name,
      billing_address: [input.toAddress.line1, input.toAddress.line2].filter(Boolean).join(', '),
      billing_city: input.toAddress.city,
      billing_pincode: input.toPostalCode.replace(/\D/g, ''),
      billing_state: input.toAddress.state,
      billing_country: 'India',
      billing_email: 'noreply@example.com',
      billing_phone: input.toAddress.phone,
      shipping_is_billing: true,
      order_items: [{
        name: 'Jewellery',
        sku: input.orderRef,
        units: input.itemCount,
        selling_price: input.declaredValue / Math.max(1, input.itemCount),
      }],
      payment_method: input.paymentMode === 'COD' ? 'COD' : 'Prepaid',
      sub_total: input.declaredValue,
      length: 15,
      breadth: 10,
      height: 5,
      weight: Math.max(0.1, input.weightGrams / 1000),
    };

    const orderRes = await fetchJson(`${HOST}/v1/external/orders/create/adhoc`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(orderPayload),
    }, 12000);
    if (orderRes.status >= 400 || !orderRes.body?.shipment_id) {
      throw new Error(orderRes.body?.message || 'Shiprocket order creation failed');
    }
    const shipmentId = orderRes.body.shipment_id;

    // Step 2: assign an AWB. courier_id may be passed via input.serviceCode (from quote selection).
    const awbBody: Record<string, unknown> = { shipment_id: shipmentId };
    if (input.serviceCode) awbBody.courier_id = input.serviceCode;
    const awbRes = await fetchJson(`${HOST}/v1/external/courier/assign/awb`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(awbBody),
    }, 12000);
    if (awbRes.status >= 400) {
      throw new Error(awbRes.body?.message || 'Shiprocket AWB assignment failed');
    }
    const awb = awbRes.body?.response?.data?.awb_code || awbRes.body?.awb_code;
    if (!awb) throw new Error('Shiprocket did not return an AWB');

    // Step 3: best-effort label fetch (non-fatal)
    let labelUrl: string | undefined;
    try {
      const lr = await fetchJson(`${HOST}/v1/external/courier/generate/label`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      }, 8000);
      labelUrl = lr.body?.label_url;
    } catch { /* ignore */ }

    return {
      awb,
      labelUrl,
      trackingUrl: `https://shiprocket.co/tracking/${awb}`,
      raw: { order: orderRes.body, awb: awbRes.body },
    };
  },

  async track(ctx, awb: string): Promise<TrackingEvent[]> {
    const token = await login(ctx);
    const { status, body } = await fetchJson(
      `${HOST}/v1/external/courier/track/awb/${encodeURIComponent(awb)}`,
      { headers: authHeaders(token) },
    );
    if (status >= 400) return [];
    const data = body?.tracking_data ?? body;
    const activities = data?.shipment_track_activities ?? data?.track_activities ?? [];
    if (!Array.isArray(activities)) return [];
    return activities.map((a: any): TrackingEvent => ({
      status: a?.status ?? a?.activity ?? 'UPDATE',
      description: a?.activity ?? a?.status_description ?? undefined,
      location: a?.location ?? undefined,
      timestamp: a?.date ?? a?.activity_date ?? new Date().toISOString(),
    }));
  },
};
