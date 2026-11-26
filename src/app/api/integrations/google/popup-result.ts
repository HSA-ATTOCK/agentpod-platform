import { publicOrigin } from "@/lib/origin";

export type ConnectResult = { ok: true; account: string } | { ok: false; error: string };

/**
 * The page the Google sign-in window ends on when it was opened from the chat:
 * tells the chat what happened (only same-origin pages can hear it) and closes itself.
 */
export function popupResult(request: Request, result: ConnectResult, provider = "google") {
  const origin = publicOrigin(request);
  const payload = JSON.stringify({ type: "baba-connect", provider, ...result }).replace(/</g, "\\u003c");
  const message = result.ok ? `Connected ${result.account}. You can close this window.` : result.error;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baba</title></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;text-align:center">
<p id="m"></p>
<script>
  var data = ${payload};
  document.getElementById("m").textContent = ${JSON.stringify(message).replace(/</g, "\\u003c")};
  try { if (window.opener) { window.opener.postMessage(data, ${JSON.stringify(origin)}); setTimeout(function () { window.close(); }, 600); } } catch (e) {}
</script></body></html>`;
  const response = new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return response;
}
