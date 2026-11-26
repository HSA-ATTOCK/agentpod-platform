import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts tokens for connected tools before they're stored (AES-256-GCM, 16-byte tag).
 * Key: INTEGRATIONS_ENCRYPTION_KEY if set (recommended: 32+ random bytes), otherwise derived
 * from SUPABASE_SECRET_KEY. Changing the key means everyone has to reconnect their tools.
 *
 * Format v2: "v2.<iv>.<tag>.<data>", key from HKDF-SHA256. Values saved earlier in the
 * three-part v1 format still decrypt.
 */
function secret() {
  const value = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error("No encryption key: set SUPABASE_SECRET_KEY (or INTEGRATIONS_ENCRYPTION_KEY).");
  return value;
}

function keyV2() {
  return Buffer.from(hkdfSync("sha256", secret(), "baba-integrations-salt", "baba-integrations:v2", 32));
}

function keyV1() {
  return createHash("sha256").update(`baba-integrations:${secret()}`).digest();
}

const TAG = 16;

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyV2(), iv, { authTagLength: TAG });
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v2", ...[iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url"))].join(".");
}

export function decrypt(sealed: string) {
  const parts = sealed.split(".");
  const v2 = parts[0] === "v2";
  const [iv, tag, data] = (v2 ? parts.slice(1) : parts).map((p) => Buffer.from(p, "base64url"));
  if (parts.length !== (v2 ? 4 : 3) || iv?.length !== 12 || tag?.length !== TAG) throw new Error("Stored secret is damaged.");
  const decipher = createDecipheriv("aes-256-gcm", v2 ? keyV2() : keyV1(), iv, { authTagLength: TAG });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
