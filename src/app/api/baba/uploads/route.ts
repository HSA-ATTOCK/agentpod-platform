import { babaGate } from "@/lib/baba/conversations";
import { errorMessage, getClaude } from "@/lib/baba/server";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, safeFileName, signUpload } from "@/lib/baba/uploads";

export const maxDuration = 60;

/**
 * POST /api/baba/uploads — multipart form with one "file".
 * Uploads a file for Baba to work on and returns { fileId, token, name, sizeBytes }.
 * The token proves later (in /api/baba/chat) that this workspace uploaded the file.
 */
export async function POST(request: Request) {
  const gate = await babaGate({ write: true });
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "That file is empty." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Files can be up to 25 MB." }, { status: 413 });

  // Browsers don't always know the type (e.g. .md, .csv on some systems): fall back to the extension
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type =
    ALLOWED_UPLOAD_TYPES[file.type] !== undefined
      ? file.type
      : Object.entries(ALLOWED_UPLOAD_TYPES).find(([, e]) => e === ext)?.[0];
  if (!type) {
    return Response.json(
      { error: "Baba can read PDF, Word, Excel, PowerPoint, CSV, text and image files." },
      { status: 415 },
    );
  }

  try {
    const name = safeFileName(file.name);
    const uploaded = await getClaude().beta.files.upload({
      file: new File([await file.arrayBuffer()], name, { type }),
      // Kept for 30 days: long enough to finish and revisit the task
      expires_in_seconds: 30 * 24 * 60 * 60,
    });
    return Response.json({
      fileId: uploaded.id,
      token: signUpload(uploaded.id, gate.ctx.workspace.id),
      name,
      mimeType: type,
      sizeBytes: file.size,
    });
  } catch (error) {
    console.error("[baba/uploads]", error);
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
