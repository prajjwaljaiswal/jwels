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

// DTDC REST API v1.
// Base URL: https://api.dtdc.com/restApi/v1/
// Auth: HTTP Basic — Base64(clientId + '_' + customerCode + ':' + password)
//
// Endpoints used:
//   GET  /serviceability?originPin=&destinationPin=         → verify + serviceability check
//   POST /findRates                                          → rate quotes
//   POST /shipmentBooking                                    → create shipment, returns AWBNo
//   GET  /track/shipment/{awb}                              → tracking events

const HOST = 'https://api.dtdc.com/restApi/v1';

interface DtdcCreds {
  clientId: string;
  password: string;
}
interface DtdcDefaults {
  customerCode?: string;
  pickupPincode?: string;
}

function basicAuth(ctx: CarrierContext): string {
  const creds = ctx.credentials as unknown as DtdcCreds;
  const defaults = (ctx.defaults || {}) as DtdcDefaults;
  const username = `${creds.clientId}_${defaults.customerCode || ''}`;
  return 'Basic ' + Buffer.from(`${username}:${creds.password}`).toString('base64');
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

export const dtdc: CarrierAdapter = {
  key: 'DTDC',
  displayName: 'DTDC',
  category: 'DOMESTIC',
  supportedServices: [
    { code: 'P', name: 'Priority',  serviceType: 'EXPRESS',  etaMinDays: 1, etaMaxDays: 2 },
    { code: 'E', name: 'Express',   serviceType: 'STANDARD', etaMinDays: 2, etaMaxDays: 4 },
    { code: 'A', name: 'Air Cargo', serviceType: 'EXPRESS',  etaMinDays: 1, etaMaxDays: 3 },
  ],

  credentialFields: [
    {
      key: 'clientId',
      label: 'Client ID',
      type: 'text',
      required: true,
      helpText: 'Your DTDC client ID from the DTDC business account dashboard.',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'secret',
      required: true,
      helpText: 'API password associated with your DTDC client ID.',
    },
    {
      key: 'customerCode',
      label: 'Customer Code',
      type: 'text',
      required: true,
      isDefault: true,
      helpText: 'Your DTDC customer code (e.g. B12345). Shown on your DTDC account page.',
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
    const defaults = (ctx.defaults || {}) as DtdcDefaults;
    const pin = (defaults.pickupPincode || '110001').replace(/\D/g, '');
    const url = `${HOST}/serviceability?originPin=${pin}&destinationPin=${pin}`;
    try {
      const { status, body } = await fetchJson(url, {
        headers: {
          Authorization: basicAuth(ctx),
          Accept: 'application/json',
        },
      });
      if (status === 401 || status === 403) return { ok: false, message: 'Invalid credentials' };
      if (status >= 400) return { ok: false, message: `DTDC responded ${status}` };
      // A 200 with any body means credentials are accepted
      return { ok: true, message: body?.message || 'Credentials accepted' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Network error' };
    }
  },

  async quote(ctx, input: RateQuoteInput): Promise<RateQuote[]> {
    const defaults = (ctx.defaults || {}) as DtdcDefaults;
    const origin = (input.fromPostalCode || defaults.pickupPincode || '').replace(/\D/g, '');
    const dest = (input.toPostalCode || '').replace(/\D/g, '');
    if (!origin || !dest) return [];

    const payload = {
      originPin: origin,
      destinationPin: dest,
      weight: Math.max(0.5, input.weightGrams / 1000), // kg
      paymentMode: input.paymentMode === 'COD' ? 'COD' : 'PREPAID',
      declaredValue: input.declaredValue,
      productCode: 'D', // Domestic
    };

    try {
      const { status, body } = await fetchJson(`${HOST}/findRates`, {
        method: 'POST',
        headers: {
          Authorization: basicAuth(ctx),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (status >= 400 || !Array.isArray(body)) return [];

      return body
        .map((r: any): RateQuote | null => {
          const amount = Number(r?.totalAmount ?? r?.rate ?? r?.freight ?? 0);
          if (!Number.isFinite(amount) || amount <= 0) return null;
          const svcCode = r?.productCode ?? r?.serviceCode ?? 'E';
          const svc = (dtdc.supportedServices).find((s) => s.code === svcCode);
          return {
            carrier: 'DTDC',
            serviceCode: svcCode,
            serviceName: r?.productName ?? svc?.name ?? 'DTDC',
            amount,
            currency: 'INR',
            etaMinDays: svc?.etaMinDays,
            etaMaxDays: svc?.etaMaxDays,
            raw: r,
          };
        })
        .filter((q): q is RateQuote => !!q);
    } catch {
      return [];
    }
  },

  async createShipment(ctx, input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const defaults = (ctx.defaults || {}) as DtdcDefaults;
    if (!defaults.customerCode) throw new Error('DTDC customerCode is required');

    const payload = {
      customerCode: defaults.customerCode,
      productCode: input.serviceCode || 'E',
      shipmentType: 'NON-DOCUMENT',
      paymentMode: input.paymentMode === 'COD' ? 'COD' : 'PREPAID',
      codAmount: input.paymentMode === 'COD' ? input.declaredValue : 0,
      declaredValue: input.declaredValue,
      weight: Math.max(0.5, input.weightGrams / 1000),
      dimensions: { length: 15, width: 10, height: 5 },
      originDetails: {
        name: input.fromAddress.name,
        phone: input.fromAddress.phone,
        address: [input.fromAddress.line1, input.fromAddress.line2].filter(Boolean).join(', '),
        city: input.fromAddress.city,
        state: input.fromAddress.state,
        pincode: (input.fromAddress.postalCode || '').replace(/\D/g, ''),
        country: 'India',
      },
      destinationDetails: {
        name: input.toAddress.name,
        phone: input.toAddress.phone,
        address: [input.toAddress.line1, input.toAddress.line2].filter(Boolean).join(', '),
        city: input.toAddress.city,
        state: input.toAddress.state,
        pincode: input.toPostalCode.replace(/\D/g, ''),
        country: 'India',
      },
      orderReference: input.orderRef,
      pieceDetails: [{ packageNo: 1, weight: Math.max(0.5, input.weightGrams / 1000) }],
    };

    const { status, body } = await fetchJson(`${HOST}/shipmentBooking`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(ctx),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }, 15000);

    if (status >= 400) {
      const msg = body?.message ?? body?.error ?? `DTDC responded ${status}`;
      throw new Error(`DTDC shipment failed: ${msg}`);
    }

    const awb = body?.AWBNo ?? body?.awbNo ?? body?.awb;
    if (!awb) {
      throw new Error('DTDC did not return an AWB. Response: ' + JSON.stringify(body).slice(0, 200));
    }

    return {
      awb,
      // DTDC does not provide a PDF label endpoint — tracking page link only
      trackingUrl: `https://www.dtdc.in/trace-details.asp?awbno=${encodeURIComponent(awb)}`,
      raw: body,
    };
  },

  async track(ctx, awb: string): Promise<TrackingEvent[]> {
    const url = `${HOST}/track/shipment/${encodeURIComponent(awb)}`;
    try {
      const { status, body } = await fetchJson(url, {
        headers: {
          Authorization: basicAuth(ctx),
          Accept: 'application/json',
        },
      });
      if (status >= 400) return [];
      const scans = body?.trackingDetails ?? body?.scanDetails ?? body?.events ?? [];
      if (!Array.isArray(scans)) return [];
      return scans.map((s: any): TrackingEvent => ({
        status: s?.status ?? s?.scanType ?? 'UPDATE',
        description: s?.statusDescription ?? s?.description ?? undefined,
        location: s?.location ?? s?.city ?? undefined,
        timestamp: s?.scanDate ?? s?.timestamp ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },
};
