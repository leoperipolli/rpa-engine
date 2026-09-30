import { createDecipheriv } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Decrypts a value produced by the backend's encrypt() function.
 * Expected format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format — expected "iv:authTag:data"');
  }

  const [ivHex, authTagHex, dataHex] = parts;
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
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
 * Decrypts a secrets map previously encrypted by the backend.
 * Returns an empty object when the stored value is null (recipe has no secrets).
 */
export function decryptSecrets(encrypted: string | null): Record<string, string> {
  if (!encrypted) return {};
  return JSON.parse(decrypt(encrypted)) as Record<string, string>;
}
