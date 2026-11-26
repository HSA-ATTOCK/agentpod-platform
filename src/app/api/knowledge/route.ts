import { getAppContext } from "@/lib/data/context";
import { extractText, kindOf } from "@/lib/knowledge/extract";
import { addDocument, deleteDocument, MAX_DOCUMENT_CHARS } from "@/lib/knowledge/knowledge";

/**
 * POST   /api/knowledge — multipart form: file (PDF, Word .docx, text, Markdown, CSV, JSON, HTML) and optional title,
 *                         or JSON { title, text } for pasted text.
 * DELETE /api/knowledge — body: { id }
 */
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (ctx.workspace.role === "viewer") return Response.json({ error: "Viewers can't add documents." }, { status: 403 });

  let title = "";
  let text = "";
  let fileName: string | undefined;
  let mimeType: string | undefined;
  try {
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      title = String(form.get("title") ?? "");
      if (!(file instanceof File)) return Response.json({ error: "Choose a file." }, { status: 400 });
      if (file.size > MAX_BYTES) return Response.json({ error: "Files can be up to 20 MB." }, { status: 413 });
      const kind = kindOf(file.name, file.type);
      if (!kind) {
        return Response.json({ error: "Add PDF, Word (.docx), text, Markdown, CSV, JSON or HTML files." }, { status: 415 });
      }
      fileName = file.name.slice(0, 200);
      mimeType = file.type || "text/plain";
      try {
        text = await extractText(await file.arrayBuffer(), kind);
      } catch {
        return Response.json({ error: "Couldn't read that file. If it's password-protected, remove the password and try again." }, { status: 400 });
      }
      // A scanned PDF has pictures of text, not text
      if (kind === "pdf" && text.replace(/\[Page \d+\]/g, "").trim().length < 20) {
        return Response.json({ error: "This PDF has no text layer (it's probably scanned). Attach it in Ask Baba instead; Baba can read scanned pages." }, { status: 422 });
      }
    } else {
      const body = (await request.json()) as { title?: string; text?: string };
      title = body.title ?? "";
      text = body.text ?? "";
    }
    if (text.length > MAX_DOCUMENT_CHARS) return Response.json({ error: "That document is too long (max 2 million characters)." }, { status: 413 });
    const result = await addDocument(ctx, { title: title || fileName || "Untitled", text, fileName, mimeType });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't add the document." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  try {
    await deleteDocument(ctx, String(id ?? ""));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't delete." }, { status: 400 });
  }
}
