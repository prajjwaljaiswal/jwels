import { ShippingMethod, VendorCarrierAccount } from '@prisma/client';
import { decryptJson } from './crypto';
import { getCarrier, RateQuote } from './carriers';

export interface QuoteItem {
  productId: string;
  vendorId: string;
  quantity: number;
  unitPrice: number;
  weightGrams?: number;
}

export interface QuoteOption {
  methodId: string;
  carrier: string;
  serviceCode: string | null;       // null for FLAT
  name: string;                     // user-facing label
  amount: number;                   // INR
  etaMinDays: number;
  etaMaxDays: number;
  rateMode: 'FLAT' | 'LIVE';
}

export interface VendorQuoteGroup {
  vendorId: string;
  itemCount: number;
  subtotal: number;
  options: QuoteOption[];
  warnings?: string[];
}

const DEFAULT_WEIGHT_GRAMS = 200;
const LIVE_QUOTE_TIMEOUT_MS = 4000;

// Fallback shipping options shown when a vendor has no active ShippingMethod rows
// for the destination. Lets a customer always pick something at checkout; vendor
// can override by configuring real methods on /vendor/shipping.
export const SYSTEM_DEFAULTS = {
  STANDARD: { id: 'system-standard', name: 'Standard', amount: 50,  etaMin: 4, etaMax: 7 },
  EXPRESS:  { id: 'system-express',  name: 'Express',  amount: 150, etaMin: 1, etaMax: 3 },
} as const;

function systemDefaultOptions(): QuoteOption[] {
  return [SYSTEM_DEFAULTS.STANDARD, SYSTEM_DEFAULTS.EXPRESS].map((d) => ({
    methodId: d.id,
    carrier: 'STANDARD',
    serviceCode: null,
    name: d.name,
    amount: d.amount,
    etaMinDays: d.etaMin,
    etaMaxDays: d.etaMax,
    rateMode: 'FLAT' as const,
  }));
}

export function isSystemDefaultMethodId(id: string): boolean {
  return id === SYSTEM_DEFAULTS.STANDARD.id || id === SYSTEM_DEFAULTS.EXPRESS.id;
}

export function priceSystemDefault(methodId: string): { amount: number; carrier: string; service: string } | null {
  if (methodId === SYSTEM_DEFAULTS.STANDARD.id) return { amount: SYSTEM_DEFAULTS.STANDARD.amount, carrier: 'STANDARD', service: SYSTEM_DEFAULTS.STANDARD.name };
  if (methodId === SYSTEM_DEFAULTS.EXPRESS.id)  return { amount: SYSTEM_DEFAULTS.EXPRESS.amount,  carrier: 'STANDARD', service: SYSTEM_DEFAULTS.EXPRESS.name };
  return null;
}

/**
 * Compute the cost of a FLAT shipping method given subtotal & item count.
 * Mirrors the rule documented in CLAUDE.md so the frontend can preview the same number.
 */
export function flatCost(method: ShippingMethod, subtotal: number, itemCount: number): number {
  const free = method.freeAbove ? Number(method.freeAbove) : null;
  if (free != null && subtotal >= free) return 0;
  const base = Number(method.baseRate);
  const per = method.perItemRate ? Number(method.perItemRate) : 0;
  return base + per * Math.max(0, itemCount - 1);
}

function zoneMatches(method: ShippingMethod, destState: string | null): boolean {
  if (!method.zones || method.zones.length === 0) return true;
  if (method.zones.includes('*')) return true;
  if (!destState) return true; // can't filter without info — be permissive
  // Zones are stored like "IN-DL"; match by the suffix or full code.
  const code = destState.toUpperCase();
  return method.zones.some((z) => z.toUpperCase().endsWith(code));
}

async function fetchLiveQuotes(
  method: ShippingMethod & { carrierAccount: VendorCarrierAccount | null },
  args: {
    fromPostalCode: string;
    toPostalCode: string;
    toCountry: string;
    toState: string | null;
    weightGrams: number;
    declaredValue: number;
    itemCount: number;
    paymentMode: 'PREPAID' | 'COD';
  },
): Promise<RateQuote[]> {
  const acct = method.carrierAccount;
  if (!acct) return [];
  const adapter = getCarrier(acct.carrier);
  if (!adapter) return [];

  let credentials: Record<string, unknown> = {};
  try { credentials = decryptJson<Record<string, unknown>>(acct.credentials); } catch { return []; }

  const ctx = {
    mode: acct.mode,
    credentials,
    defaults: (acct.defaultsJson as Record<string, unknown> | null) ?? null,
  };

  return Promise.race<RateQuote[]>([
    adapter.quote(ctx, {
      fromPostalCode: args.fromPostalCode,
      toPostalCode: args.toPostalCode,
      toCountry: args.toCountry,
      weightGrams: args.weightGrams,
      declaredValue: args.declaredValue,
      itemCount: args.itemCount,
      paymentMode: args.paymentMode,
    }),
    new Promise<RateQuote[]>((resolve) => setTimeout(() => resolve([]), LIVE_QUOTE_TIMEOUT_MS)),
  ]).catch(() => [] as RateQuote[]);
}

/**
 * Build per-vendor quote groups for a cart. Pure data — caller decides UX.
 *
 * For each vendor:
 *   1. Pick FLAT methods whose `zones` match the destination → priced from `flatCost`
 *   2. For LIVE methods, call the carrier adapter (in parallel) → one option per returned service
 *   3. Sort options by cheapest first
 */
export async function quoteVendorGroups(input: {
  groups: { vendorId: string; items: QuoteItem[] }[];
  destination: { postalCode: string; state: string; country: string };
  paymentMode: 'PREPAID' | 'COD';
  fetchVendorMethods: (vendorIds: string[]) => Promise<
    (ShippingMethod & { carrierAccount: VendorCarrierAccount | null })[]
  >;
  fetchVendorAddresses: (vendorIds: string[]) => Promise<Map<string, { postalCode: string }>>;
}): Promise<VendorQuoteGroup[]> {
  const vendorIds = input.groups.map((g) => g.vendorId);
  const [methods, addresses] = await Promise.all([
    input.fetchVendorMethods(vendorIds),
    input.fetchVendorAddresses(vendorIds),
  ]);

  return Promise.all(input.groups.map(async (g) => {
    const itemCount = g.items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = g.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const weight = g.items.reduce((s, i) => s + (i.weightGrams ?? DEFAULT_WEIGHT_GRAMS) * i.quantity, 0);

    const vendorMethods = methods.filter(
      (m) => m.vendorId === g.vendorId && m.isActive && zoneMatches(m, input.destination.state),
    );
    const fromPin = addresses.get(g.vendorId)?.postalCode || '';

    const options: QuoteOption[] = [];
    const warnings: string[] = [];

    // FLAT methods
    for (const m of vendorMethods.filter((x) => x.rateMode === 'FLAT')) {
      options.push({
        methodId: m.id,
        carrier: m.carrier,
        serviceCode: null,
        name: m.name,
        amount: flatCost(m, subtotal, itemCount),
        etaMinDays: m.etaMinDays,
        etaMaxDays: m.etaMaxDays,
        rateMode: 'FLAT',
      });
    }

    // LIVE methods — only quote when we have a pickup pincode
    const liveMethods = vendorMethods.filter((x) => x.rateMode === 'LIVE');
    if (liveMethods.length && !fromPin) {
      warnings.push('Vendor pickup address missing — live rates unavailable');
    } else {
      const liveResults = await Promise.all(
        liveMethods.map(async (m) => {
          const quotes = await fetchLiveQuotes(m, {
            fromPostalCode: fromPin,
            toPostalCode: input.destination.postalCode,
            toCountry: input.destination.country,
            toState: input.destination.state,
            weightGrams: Math.max(weight, 100),
            declaredValue: subtotal,
            itemCount,
            paymentMode: input.paymentMode,
          });
          if (!quotes.length) {
            warnings.push(`Live rate unavailable for "${m.name}" — using flat alternatives if any`);
            return [] as QuoteOption[];
          }
          return quotes.map<QuoteOption>((q) => ({
            methodId: m.id,
            carrier: q.carrier,
            serviceCode: q.serviceCode,
            name: `${m.name} · ${q.serviceName}`,
            amount: q.amount,
            etaMinDays: q.etaMinDays ?? m.etaMinDays,
            etaMaxDays: q.etaMaxDays ?? m.etaMaxDays,
            rateMode: 'LIVE',
          }));
        }),
      );
      for (const list of liveResults) options.push(...list);
    }

    // Always offer system defaults so customers can pick a method even when the
    // vendor hasn't configured any. Vendor-defined options take priority.
    if (options.length === 0) {
      options.push(...systemDefaultOptions());
    }

    options.sort((a, b) => a.amount - b.amount);

    return {
      vendorId: g.vendorId,
      itemCount,
      subtotal,
      options,
      warnings: warnings.length ? warnings : undefined,
    };
  }));
}

/**
 * Server-side recompute of a single (vendorId, methodId, optional serviceCode) selection.
 * Called from /orders/checkout to verify the price the client sent.
 */
export async function priceSelection(args: {
  method: ShippingMethod & { carrierAccount: VendorCarrierAccount | null };
  vendorPickup: { postalCode: string } | null;
  destination: { postalCode: string; state: string; country: string };
  items: QuoteItem[];
  serviceCode?: string | null;
  paymentMode: 'PREPAID' | 'COD';
}): Promise<{ amount: number; carrier: string; service: string }> {
  const itemCount = args.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = args.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  if (args.method.rateMode === 'FLAT') {
    return {
      amount: flatCost(args.method, subtotal, itemCount),
      carrier: args.method.carrier,
      service: args.method.name,
    };
  }

  if (!args.vendorPickup?.postalCode) {
    throw new Error('Vendor pickup address missing — cannot compute live shipping rate');
  }
  const weight = Math.max(
    args.items.reduce((s, i) => s + (i.weightGrams ?? DEFAULT_WEIGHT_GRAMS) * i.quantity, 0),
    100,
  );

  const quotes = await fetchLiveQuotes(args.method, {
    fromPostalCode: args.vendorPickup.postalCode,
    toPostalCode: args.destination.postalCode,
    toCountry: args.destination.country,
    toState: args.destination.state,
    weightGrams: weight,
    declaredValue: subtotal,
    itemCount,
    paymentMode: args.paymentMode,
  });
  if (!quotes.length) throw new Error('Live rate unavailable from carrier');

  const picked = args.serviceCode
    ? quotes.find((q) => q.serviceCode === args.serviceCode) ?? quotes[0]
    : quotes[0];

  return {
    amount: picked.amount,
    carrier: picked.carrier,
    service: picked.serviceName,
  };
}
