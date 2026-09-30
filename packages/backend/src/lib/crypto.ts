import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
// 96-bit IV is the recommended size for GCM (12 bytes)
const IV_BYTES = 12;
// 128-bit authentication tag (GCM default)
const TAG_BYTES = 16;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-separated string: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext.toString('hex'),
  ].join(':');
}

/**
 * Decrypts a value previously produced by `encrypt()`.
 * Throws if the ciphertext is tampered or the key is wrong.
 */
export function decrypt(ciphertext: string): string {
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format — expected "iv:authTag:data"');
  }

  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error('Invalid ciphertext — unexpected IV or authTag length');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * Encrypts a secrets map.  Returns null when the map is empty/undefined.
 */
export function encryptSecrets(
  secrets: Record<string, string> | undefined,
): string | null {
  if (!secrets || Object.keys(secrets).length === 0) return null;
  return encrypt(JSON.stringify(secrets));
}

/**
 * Decrypts a secrets map previously produced by `encryptSecrets()`.
 * Returns an empty object when the stored value is null.
 */
export function decryptSecrets(
  encrypted: string | null,
): Record<string, string> {
  if (!encrypted) return {};
  return JSON.parse(decrypt(encrypted)) as Record<string, string>;
}
