import "server-only";

/** The placeholder the Website Builder puts in form actions; replaced when the site is served or published. */
export const FORM_ENDPOINT_TOKEN = "__BABA_FORM_ENDPOINT__";

export function withFormEndpoint(html: string, endpoint: string) {
  return html.split(FORM_ENDPOINT_TOKEN).join(endpoint);
}

const MAX_FIELDS = 30;
const MAX_VALUE = 2000;

/** Keeps only plain text fields (no files), with size limits. Fields starting with "_" are controls, not data. */
export function cleanFormFields(entries: Iterable<[string, unknown]>) {
  const data: Record<string, string> = {};
  const controls: Record<string, string> = {};
  let count = 0;
  for (const [rawKey, rawValue] of entries) {
    if (typeof rawValue !== "string") continue;
    const key = rawKey.trim().slice(0, 60);
    if (!key) continue;
    const value = rawValue.trim().slice(0, MAX_VALUE);
    if (key.startsWith("_")) {
      controls[key] = value;
      continue;
    }
    if (count >= MAX_FIELDS) break;
    data[key] = data[key] ? `${data[key]}, ${value}` : value;
    count++;
  }
  return { data, controls };
}

/** A relative page inside the site to go to after sending (e.g. "thank-you.html"), or null. */
export function safeNextPage(value: string | undefined) {
  if (!value) return null;
  const v = value.trim().replace(/^\.?\//, "");
  return /^[A-Za-z0-9_\-/.]{1,120}$/.test(v) && !v.includes("..") ? v : null;
}
