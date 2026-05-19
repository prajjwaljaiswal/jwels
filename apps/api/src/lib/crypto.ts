import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// AES-256-GCM. Output format: base64( iv(12) | authTag(16) | ciphertext )
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SHIPPING_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('SHIPPING_ENCRYPTION_KEY is not set');
  }
  // Accept either 32 raw bytes (base64/hex) or any string — derive 32 bytes via SHA-256 for convenience.
  let key: Buffer;
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    try {
      const b = Buffer.from(raw, 'base64');
      key = b.length === 32 ? b : createHash('sha256').update(raw).digest();
    } catch {
      key = createHash('sha256').update(raw).digest();
    }
  }
  cachedKey = key;
  return key;
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptJson<T = unknown>(payload: string): T {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Invalid ciphertext');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}

/**
 * Validate that the encryption key env var is set and usable.
 * Call this from app boot so misconfiguration surfaces immediately,
 * not on the first encrypt/decrypt request in production.
 */
export function assertEncryptionKeyConfigured(): void {
  if (!process.env.SHIPPING_ENCRYPTION_KEY) {
    throw new Error(
      'SHIPPING_ENCRYPTION_KEY is not set. This key encrypts vendor carrier and payment credentials. Generate one with: npm run gen:enc-key',
    );
  }
  // Force-derive the key now so an invalid value also fails fast.
  getKey();
  // Round-trip test to catch unusable keys (e.g. wrong length after derivation).
  const probe = encryptJson({ probe: 1 });
  decryptJson(probe);
}

// Mask a secret value for display (keep last 4 chars).
export function maskSecret(value: string | null | undefined): string {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 4) return '*'.repeat(s.length);
  return '*'.repeat(Math.min(8, s.length - 4)) + s.slice(-4);
}

// Encrypt/decrypt opaque strings (PAN, bank account #) using the same key.
// Stored format: same as encryptJson (base64 iv|tag|ct) but the plaintext is the raw string.
export function encryptString(value: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(value, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptString(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const key = getKey();
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_LEN + TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    return null;
  }
}
