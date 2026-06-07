import type { CarrierAdapter, CredentialField } from './types';
import { delhivery } from './delhivery';
import { shiprocket } from './shiprocket';
import { fedex } from './fedex';
import { dtdc } from './dtdc';
import { bluedart } from './bluedart';

// Register adapters here. Adding a new carrier = create a file, import, and append.
// The vendor UI auto-discovers all registered adapters: groups by category, renders
// credential fields dynamically, and populates the service dropdown from supportedServices.
const ADAPTERS: CarrierAdapter[] = [
  delhivery,
  dtdc,
  bluedart,
  shiprocket,
  fedex,
];

const REGISTRY: Map<string, CarrierAdapter> = new Map(
  ADAPTERS.map((a) => [a.key, a]),
);

export function getCarrier(key: string): CarrierAdapter | null {
  return REGISTRY.get(key.toUpperCase()) ?? null;
}

export function requireCarrier(key: string): CarrierAdapter {
  const a = getCarrier(key);
  if (!a) throw new Error(`Unknown carrier: ${key}`);
  return a;
}

export interface CarrierManifestEntry {
  key: string;
  displayName: string;
  logoUrl?: string;
  category: string;
  supportedServices: import('./types').CarrierServiceDef[];
  credentialFields: CredentialField[];
  supportsCreateShipment: boolean;
  supportsTracking: boolean;
}

export function listCarriers(): CarrierManifestEntry[] {
  return ADAPTERS.map((a) => ({
    key: a.key,
    displayName: a.displayName,
    logoUrl: a.logoUrl,
    category: a.category,
    supportedServices: a.supportedServices,
    credentialFields: a.credentialFields,
    supportsCreateShipment: typeof a.createShipment === 'function',
    supportsTracking: typeof a.track === 'function',
  }));
}

export type { CarrierAdapter, CarrierContext, CarrierServiceDef, CredentialField, RateQuote, RateQuoteInput, VerifyResult } from './types';
