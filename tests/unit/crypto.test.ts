import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { test } from "node:test";

process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-key-for-unit-tests-only-0123456789";

const load = async () => ({
  ...(await import("../../src/lib/integrations/crypto")),
  ...(await import("../../src/lib/integrations/connections")),
  ...(await import("../../src/lib/integrations/google/oauth")),
});

test("crypto: v2 round trip and tamper detection", async () => {
  const { decrypt, encrypt } = await load();
  const sealed = encrypt("secret-token");
  assert.match(sealed, /^v2\./);
  assert.equal(decrypt(sealed), "secret-token");
  const parts = sealed.split(".");
  parts[3] = Buffer.from("xxxx").toString("base64url");
  assert.throws(() => decrypt(parts.join(".")));
  assert.throws(() => decrypt("v2.abc"));
});

test("crypto: values saved in the old format still decrypt", async () => {
  const { decrypt } = await load();
  const key = createHash("sha256").update(`baba-integrations:${process.env.INTEGRATIONS_ENCRYPTION_KEY}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update("old-token", "utf8"), cipher.final()]);
  const v1 = [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
  assert.equal(decrypt(v1), "old-token");
});

test("api keys: encoded forms are hidden too", async () => {
  const { hideKey } = await load();
  const key = "sk_live_abc+/def=123456";
  const echoed = [key, encodeURIComponent(key), Buffer.from(key).toString("base64"), Buffer.from(key).toString("base64url")].join(" | ");
  assert.ok(!hideKey(echoed, key).includes("abc"), hideKey(echoed, key));
});

test("oauth state: signed, tamper-proof and expires", async () => {
  const { readState, signState } = await load();
  const state = { workspaceId: "w", userId: "u", nonce: "n", popup: false, returnTo: "/x" } as never;
  const signed = signState(state);
  assert.equal(readState(signed)?.workspaceId, "w");
  assert.equal(readState(`${signed}x`), null);
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 11 * 60 * 1000;
    assert.equal(readState(signed), null);
  } finally {
    Date.now = realNow;
  }
});
