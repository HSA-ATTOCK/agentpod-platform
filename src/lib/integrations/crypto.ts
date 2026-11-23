import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts tokens for connected tools before they're stored (AES-256-GCM).
 * Key: INTEGRATIONS_ENCRYPTION_KEY if set, otherwise derived from SUPABASE_SECRET_KEY.
 * Changing the key means everyone has to reconnect their tools.
 */
function key() {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("No encryption key: set SUPABASE_SECRET_KEY (or INTEGRATIONS_ENCRYPTION_KEY).");
  return createHash("sha256").update(`baba-integrations:${secret}`).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(sealed: string) {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
