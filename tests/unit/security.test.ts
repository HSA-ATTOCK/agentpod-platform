import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import { checkReadOnlySql } from "../../src/lib/integrations/databases";
import { cleanHost } from "../../src/lib/integrations/connections";
import { driveFileId } from "../../src/lib/integrations/google/tools";
import { unpack } from "../../src/lib/sites/sites";

test("database: read queries are allowed", () => {
  for (const sql of [
    "select * from orders",
    "WITH a AS (SELECT 1) SELECT * FROM a",
    "show tables",
    "select replace(name, 'a', 'b'), comment from products",
    "select 'drop table x' as note",
    "select now();",
  ]) {
    assert.doesNotThrow(() => checkReadOnlySql(sql), sql);
  }
});

test("database: anything that could change data is refused", () => {
  for (const sql of [
    "delete from orders",
    "update t set a = 1",
    "insert into t values (1)",
    "select 1; drop table t",
    "with x as (delete from t returning *) select * from x",
    "explain analyze select 1",
    "select pg_sleep(30)",
    "select * into outfile '/tmp/x' from t",
    "set session characteristics as transaction read write",
    "",
  ]) {
    assert.throws(() => checkReadOnlySql(sql), Error, sql);
  }
});

test("connections: private and internal hosts are refused", () => {
  assert.equal(cleanHost("https://api.example.com/v1"), "api.example.com");
  for (const host of ["localhost", "db.internal", "printer.local", "abc.supabase.co", "not a host"]) {
    assert.equal(cleanHost(host), null, host);
  }
});

test("google: file ids from links", () => {
  const id = "1AbCdEfGhIjKlMnOp_qr-st";
  assert.equal(driveFileId(id), id);
  assert.equal(driveFileId(`https://docs.google.com/document/d/${id}/edit?tab=t.0`), id);
  assert.equal(driveFileId(`https://drive.google.com/open?id=${id}`), id);
  assert.throws(() => driveFileId(`https://evil.example.com/d/${id}`));
});

test("websites: zip unpacking is safe", () => {
  const flat = unpack(zipSync({ "index.html": strToU8("<h1>Hi</h1>"), "styles.css": strToU8("a{}"), "server.php": strToU8("<?php") }));
  assert.deepEqual(flat.map((f) => f.path).sort(), ["index.html", "styles.css"], "unknown file types (server code) are dropped");
  const nested = unpack(zipSync({ "acme/index.html": strToU8("x"), "acme/img/logo.svg": strToU8("<svg/>") }));
  assert.deepEqual(nested.map((f) => f.path).sort(), ["img/logo.svg", "index.html"], "a single top folder becomes the root");
  const slip = unpack(zipSync({ "index.html": strToU8("x"), "../../etc/passwd.txt": strToU8("x") }));
  assert.deepEqual(slip.map((f) => f.path), ["index.html"], "paths outside the site are dropped");
  assert.throws(() => unpack(zipSync({ "page.html": strToU8("x") })), /index\.html/);
  assert.throws(() => unpack(strToU8("not a zip")));
});

import { createHmac } from "node:crypto";
import { formEncode, verifyStripeSignature } from "../../src/lib/billing/stripe";

test("billing: Stripe webhook signatures are checked", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const t = 1_800_000_000;
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t), true);
  assert.equal(verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret, t), false, "changed body");
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, "whsec_other", t), false, "wrong secret");
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 3600), false, "too old (replay)");
  assert.equal(verifyStripeSignature(body, null, secret, t), false, "missing header");
});

test("billing: Stripe form encoding", () => {
  assert.deepEqual(formEncode({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], metadata: { a: "b" } }), [
    "mode=subscription",
    "line_items%5B0%5D%5Bprice%5D=price_1",
    "line_items%5B0%5D%5Bquantity%5D=1",
    "metadata%5Ba%5D=b",
  ]);
});

import { oauthAuthorizeUrl, PROVIDERS } from "../../src/lib/integrations/oauth-apps";

test("integrations: sign-in links carry the right redirect, scopes and state", () => {
  const slack = new URL(oauthAuthorizeUrl("https://app.example.com", "slack", "STATE", { id: "123.456", secret: "x" }));
  assert.equal(slack.origin + slack.pathname, "https://slack.com/oauth/v2/authorize");
  assert.equal(slack.searchParams.get("redirect_uri"), "https://app.example.com/api/integrations/oauth/slack/callback");
  assert.equal(slack.searchParams.get("state"), "STATE");
  assert.match(slack.searchParams.get("scope")!, /chat:write/);
  const ms = new URL(oauthAuthorizeUrl("https://app.example.com", "microsoft", "S", { id: "00000000-0000-0000-0000-000000000000", secret: "x" }));
  assert.match(ms.searchParams.get("scope")!, /offline_access/);
  assert.equal(ms.searchParams.get("response_type"), "code");
});

test("integrations: client ids are checked per service", () => {
  assert.ok(PROVIDERS.slack.clientIdPattern.test("1234567890.9876543210"));
  assert.ok(!PROVIDERS.slack.clientIdPattern.test("not-an-id"));
  assert.ok(PROVIDERS.microsoft.clientIdPattern.test("0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0"));
  assert.ok(!PROVIDERS.microsoft.clientIdPattern.test("abc"));
});
