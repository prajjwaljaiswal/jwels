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

// Blue Dart REST API (apigateway.bluedart.com)
// Auth flow: POST /in/transportation/token/v1/login → JWT token (valid ~8h)
// Tracking:  GET  /in/transportation/track/v1/shipments?waybillNo={awb}&type=S
// Headers:   clientid: {licenseKey}   Authorization: Bearer {jwtToken}
//
// Dates in responses use .NET JSON format: /Date(epochMillis+offset)/
// Parse with: String(val).match(/\/Date\((\d+)/)

const BASE = 'https://apigateway.bluedart.com';

interface BlueDartCreds {
  loginId:    string;
  licenseKey: string;
  apiKey?:    string;
}

function parseNetDate(val: unknown): string {
  const m = String(val ?? '').match(/\/Date\((\d+)/);
  return m ? new Date(parseInt(m[1], 10)).toISOString() : new Date().toISOString();
}

async function getToken(creds: BlueDartCreds): Promise<string> {
  const res = await fetch(`${BASE}/in/transportation/token/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      LoginID:    creds.loginId,
      LicenceKey: creds.licenseKey,
      APIType:    'S',
      APIVersion: '1.3',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data?.IsSuccess || !data?.JWTToken) {
    throw new Error(data?.Reason ?? `Blue Dart auth failed (HTTP ${res.status})`);
  }
  return data.JWTToken as string;
}

export const bluedart: CarrierAdapter = {
  key: 'BLUEDART',
  displayName: 'Blue Dart',
  category: 'DOMESTIC',
  supportedServices: [
    { code: 'D', name: 'Dart Apex (Overnight)',   serviceType: 'OVERNIGHT', etaMinDays: 1, etaMaxDays: 2 },
    { code: 'P', name: 'Priority (Door-to-Door)', serviceType: 'EXPRESS',   etaMinDays: 1, etaMaxDays: 3 },
    { code: 'E', name: 'Express',                 serviceType: 'STANDARD',  etaMinDays: 2, etaMaxDays: 4 },
  ],

  credentialFields: [
    {
      key: 'loginId',
      label: 'Login ID',
      type: 'text',
      required: true,
      helpText: 'Blue Dart NetConnect / API Gateway login ID.',
    },
    {
      key: 'licenseKey',
      label: 'License Key',
      type: 'secret',
      required: true,
      isDefault: true,
      helpText: 'License key from Blue Dart API Gateway — used as clientid in every request.',
    },
    {
      key: 'apiKey',
      label: 'API Key (optional)',
      type: 'secret',
      required: false,
      helpText: 'API key from developer portal, if required by your Blue Dart plan.',
    },
    {
      key: 'pickupPincode',
      label: 'Pickup Pincode',
      type: 'text',
      required: true,
      isDefault: true,
      helpText: 'Default origin pincode for rate quotes.',
    },
  ],

  async verify(ctx: CarrierContext): Promise<VerifyResult> {
    const creds = ctx.credentials as unknown as BlueDartCreds;
    if (!creds?.loginId || !creds?.licenseKey) {
      return { ok: false, message: 'Login ID and License Key are required.' };
    }
    try {
      await getToken(creds);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e.message ?? 'Blue Dart authentication failed.' };
    }
  },

  async quote(_ctx: CarrierContext, _input: RateQuoteInput): Promise<RateQuote[]> {
    // Rate API requires SOAP — return empty to fall back to flat-rate methods.
    return [];
  },

  async createShipment(_ctx: CarrierContext, _input: CreateShipmentInput): Promise<CreateShipmentResult> {
    throw new Error('Blue Dart shipment creation via API is not yet supported. Use manual AWB entry.');
  },

  async track(ctx: CarrierContext, awb: string): Promise<TrackingEvent[]> {
    const creds = ctx.credentials as unknown as BlueDartCreds;
    if (!creds?.loginId || !creds?.licenseKey) return [];

    const token = await getToken(creds);

    const url = `${BASE}/in/transportation/track/v1/shipments?waybillNo=${encodeURIComponent(awb)}&type=S`;
    const res = await fetch(url, {
      headers: {
        clientid:      creds.licenseKey,
        Authorization: `Bearer ${token}`,
        Accept:        'application/json',
      },
    });

    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));

    const scans: any[] = data?.ShipmentData?.[0]?.Shipment?.Scans ?? [];
    return scans.map((s: any): TrackingEvent => {
      const d = s?.ScanDetail ?? s;
      return {
        status:      d?.Scan ?? d?.ScanType ?? 'UPDATE',
        description: d?.Instructions ?? d?.StatusType ?? undefined,
        location:    d?.ScannedLocation ?? undefined,
        timestamp:   parseNetDate(d?.ScanDateTimeWithMilliSeconds ?? d?.ScanDateTime),
      };
    });
  },
};
