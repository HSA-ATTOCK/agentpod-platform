import "server-only";

/**
 * Turns an uploaded file into plain text for the knowledge base.
 * Text formats are read directly; PDF (unpdf) and Word .docx (mammoth) are extracted.
 * Scanned PDFs without a text layer have no text to extract: the caller says so.
 */

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|html?|xml|yaml|yml)$/i;
const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-ndjson))/;

export type ExtractKind = "text" | "html" | "pdf" | "docx";

export function kindOf(name: string, type: string): ExtractKind | null {
  if (/\.pdf$/i.test(name) || type === "application/pdf") return "pdf";
  if (/\.docx$/i.test(name) || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (/\.html?$/i.test(name) || type === "text/html") return "html";
  if (TEXT_EXT.test(name) || TEXT_TYPES.test(type)) return "text";
  return null;
}

export function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export async function extractText(bytes: ArrayBuffer, kind: ExtractKind): Promise<string> {
  switch (kind) {
    case "pdf": {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await pdfText(pdf, { mergePages: false });
      return (Array.isArray(text) ? text : [text]).map((page, i) => `[Page ${i + 1}]\n${page.trim()}`).join("\n\n");
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return value;
    }
    case "html":
      return htmlToText(new TextDecoder().decode(bytes));
    default:
      return new TextDecoder().decode(bytes);
  }
}
