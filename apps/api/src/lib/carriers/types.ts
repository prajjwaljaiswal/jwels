// Carrier adapter contract. One implementation per shipping company; the rest of
// the app stays carrier-agnostic and goes through this interface.

export type CredentialFieldType = 'text' | 'secret' | 'select';

export interface CredentialField {
  key: string;                 // matches the property name in the credentials blob
  label: string;               // shown to the vendor
  type: CredentialFieldType;
  required?: boolean;
  helpText?: string;
  options?: { value: string; label: string }[]; // for type='select'
  // If true, the field belongs in `defaultsJson` (non-secret), not `credentials` (secret blob).
  // Use for things like pickup pincode, account number, default service code.
  isDefault?: boolean;
}

export type CarrierMode = 'TEST' | 'LIVE';

export interface VerifyResult {
  ok: boolean;
  message?: string;
}

export interface RateQuoteInput {
  fromPostalCode: string;
  toPostalCode: string;
  toCountry?: string;          // ISO-2, defaults to "IN"
  weightGrams: number;         // package weight
  declaredValue: number;       // for COD / insurance
  itemCount: number;
  paymentMode: 'PREPAID' | 'COD';
}

export interface RateQuote {
  carrier: string;             // mirrors adapter.key
  serviceCode: string;         // carrier-specific identifier ("S", "E", "FEDEX_GROUND", ...)
  serviceName: string;         // human-readable, "Surface", "Express", "Ground"
  amount: number;              // total cost in INR (or carrier currency)
  currency: string;            // ISO-4217, default "INR"
  etaMinDays?: number;
  etaMaxDays?: number;
  raw?: unknown;               // adapter's untouched response, for debugging
}

export interface CreateShipmentInput extends RateQuoteInput {
  serviceCode: string;
  fromAddress: ShipAddress;
  toAddress: ShipAddress;
  orderRef: string;
}

export interface ShipAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateShipmentResult {
  awb: string;
  labelUrl?: string;
  trackingUrl?: string;
  raw?: unknown;
}

export interface TrackingEvent {
  status: string;
  description?: string;
  location?: string;
  timestamp: string; // ISO-8601
}

export interface CarrierContext {
  mode: CarrierMode;
  credentials: Record<string, unknown>; // decrypted blob
  defaults?: Record<string, unknown> | null;
}

export interface CarrierAdapter {
  /** Stable uppercase key matching VendorCarrierAccount.carrier. */
  key: string;
  /** Display name for UI ("Delhivery", "FedEx"). */
  displayName: string;
  /** Optional logo URL — frontend can render a fallback if absent. */
  logoUrl?: string;
  /** Drives the dynamic credentials form in the vendor UI. */
  credentialFields: CredentialField[];

  verify(ctx: CarrierContext): Promise<VerifyResult>;
  quote(ctx: CarrierContext, input: RateQuoteInput): Promise<RateQuote[]>;

  createShipment?(ctx: CarrierContext, input: CreateShipmentInput): Promise<CreateShipmentResult>;
  track?(ctx: CarrierContext, awb: string): Promise<TrackingEvent[]>;
}
