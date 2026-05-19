import type { CarrierAdapter, CredentialField } from './types';
import { delhivery } from './delhivery';
import { shiprocket } from './shiprocket';
import { fedex } from './fedex';

// Register adapters here. Adding a new carrier = drop a file, import, and append.
const ADAPTERS: CarrierAdapter[] = [
  delhivery,
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
  credentialFields: CredentialField[];
  supportsCreateShipment: boolean;
  supportsTracking: boolean;
}

export function listCarriers(): CarrierManifestEntry[] {
  return ADAPTERS.map((a) => ({
    key: a.key,
    displayName: a.displayName,
    logoUrl: a.logoUrl,
    credentialFields: a.credentialFields,
    supportsCreateShipment: typeof a.createShipment === 'function',
    supportsTracking: typeof a.track === 'function',
  }));
}

export type { CarrierAdapter, CarrierContext, CredentialField, RateQuote, RateQuoteInput, VerifyResult } from './types';
