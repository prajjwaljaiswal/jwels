/**
 * Google Merchant Center push — Merchant API v1 (the successor to Content API v2.1,
 * which is retired Aug 2026). Server-to-server via a service account; no SDK dependency —
 * we mint the OAuth token from the service-account key with Node crypto (RS256) and call
 * the REST endpoint with global fetch.
 *
 * Multi-tenant model (plan §5): ONE platform-owned Merchant account (MCA) + ONE primary
 * data source of type API; every offer is tagged externalSellerId = vendorId. Products are
 * pushed with `accounts.productInputs.insert` (no customBatch in Merchant API — concurrent
 * single requests with backoff on 429/5xx).
 *
 * Prerequisites done once outside this code (plan §5): registerGcp (human admin), add the
 * service-account email as a Merchant Center user, and create the API data source.
 */
import { createSign } from 'crypto';
import { readFileSync } from 'fs';
import { Prisma } from '@prisma/client';
import type { FeedItem, FeedAvailability } from './feed';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CONTENT_SCOPE = 'https://www.googleapis.com/auth/content';
const API_BASE = 'https://merchantapi.googleapis.com/products/v1';
const MAX_RETRIES = 3;
const CONCURRENCY = 5;

export interface GoogleMerchantConfig {
  accountId: string;
  dataSourceId: string;
  contentLanguage: string;
  feedLabel: string;
}

export interface PushResult {
  offerId: string;
  ok: boolean;
  resourceName?: string; // inserted ProductInput resource name (Google's id)
  error?: string;
}

export function getGoogleMerchantConfig(): GoogleMerchantConfig | null {
  const accountId = process.env.GOOGLE_MERCHANT_ACCOUNT_ID;
  const dataSourceId = process.env.GOOGLE_MERCHANT_DATASOURCE_ID;
  if (!accountId || !dataSourceId) return null;
  if (!loadServiceAccount()) return null;
  return {
    accountId,
    dataSourceId,
    contentLanguage: process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE || 'en',
    feedLabel: process.env.GOOGLE_MERCHANT_FEED_LABEL || 'IN',
  };
}

export function isGoogleMerchantConfigured(): boolean {
  return getGoogleMerchantConfig() !== null;
}

// --- Service-account auth (no SDK) --------------------------------------------

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount | null {
  let raw: string | null = null;
  const inline = process.env.GOOGLE_MERCHANT_CREDENTIALS_JSON;
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (inline) raw = inline;
  else if (path) {
    try { raw = readFileSync(path, 'utf8'); } catch { return null; }
  }
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ServiceAccount>;
    if (j.client_email && j.private_key) {
      return { client_email: j.client_email, private_key: j.private_key };
    }
  } catch { /* fall through */ }
  return null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let tokenCache: { token: string; expEpoch: number } | null = null;

async function getAccessToken(): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expEpoch > nowSec + 60) return tokenCache.token;

  const sa = loadServiceAccount();
  if (!sa) throw new Error('Google service account credentials not configured');

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: sa.client_email, scope: CONTENT_SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }),
  );
  const signingInput = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(sa.private_key));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expEpoch: nowSec + json.expires_in };
  return json.access_token;
}

// --- FeedItem → Merchant API ProductInput -------------------------------------

const AVAILABILITY_MAP: Record<FeedAvailability, string> = {
  in_stock: 'IN_STOCK',
  out_of_stock: 'OUT_OF_STOCK',
  preorder: 'PREORDER',
  backorder: 'BACKORDER',
};

/** "399.00" → "399000000" (integer-safe micros; never float math). */
export function toAmountMicros(amount: string): string {
  return new Prisma.Decimal(amount).mul(1_000_000).toFixed(0);
}

export function toProductInput(item: FeedItem, cfg: GoogleMerchantConfig) {
  const [amount, currency] = item.price.split(' ');
  return {
    offerId: item.id,
    contentLanguage: cfg.contentLanguage,
    feedLabel: cfg.feedLabel,
    productAttributes: {
      title: item.title,
      description: item.description,
      link: item.link,
      imageLink: item.imageLink,
      ...(item.additionalImageLinks.length ? { additionalImageLinks: item.additionalImageLinks } : {}),
      availability: AVAILABILITY_MAP[item.availability],
      price: { amountMicros: toAmountMicros(amount), currencyCode: currency },
      ...(item.brand ? { brand: item.brand } : {}),
      condition: item.condition.toUpperCase(), // NEW | REFURBISHED | USED
      ...(item.gtin ? { gtins: [item.gtin] } : {}),
      ...(item.mpn ? { mpn: item.mpn } : {}),
      ...(item.googleProductCategory ? { googleProductCategory: item.googleProductCategory } : {}),
      ...(item.productType ? { productTypes: [item.productType] } : {}),
      ...(item.itemGroupId ? { itemGroupId: item.itemGroupId } : {}),
      externalSellerId: item.customLabel0, // = vendorId (multi-seller tag, required on an MCA)
    },
  };
}

// --- Insert (with backoff) ----------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function insertUrl(cfg: GoogleMerchantConfig): string {
  const ds = `accounts/${cfg.accountId}/dataSources/${cfg.dataSourceId}`;
  return `${API_BASE}/accounts/${cfg.accountId}/productInputs:insert?dataSource=${encodeURIComponent(ds)}`;
}

async function insertOne(item: FeedItem, cfg: GoogleMerchantConfig, token: string): Promise<PushResult> {
  const url = insertUrl(cfg);
  const body = JSON.stringify(toProductInput(item, cfg));
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      });
    } catch (e: any) {
      // network error — treat as retriable
      if (attempt < MAX_RETRIES) { await sleep(backoffMs(attempt)); continue; }
      return { offerId: item.id, ok: false, error: `network: ${e?.message ?? e}` };
    }
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { name?: string };
      return { offerId: item.id, ok: true, resourceName: json.name };
    }
    const retriable = res.status === 429 || res.status >= 500;
    if (retriable && attempt < MAX_RETRIES) { await sleep(backoffMs(attempt)); continue; }
    const text = (await res.text().catch(() => '')).slice(0, 300);
    return { offerId: item.id, ok: false, error: `${res.status} ${text}` };
  }
}

function backoffMs(attempt: number): number {
  // 0.5s, 1s, 2s … plus jitter
  return Math.round(500 * 2 ** attempt + Math.random() * 250);
}

/** Push a batch of feed items to Merchant Center with bounded concurrency. */
export async function pushItems(items: FeedItem[]): Promise<PushResult[]> {
  const cfg = getGoogleMerchantConfig();
  if (!cfg) throw new Error('Google Merchant not configured');
  if (items.length === 0) return [];
  const token = await getAccessToken();

  const results: PushResult[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await insertOne(items[idx], cfg!, token);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return results;
}
