import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Files people attach in Ask Baba are uploaded to Claude's Files API, which is shared by the
 * whole Anthropic account. To make sure a browser can only attach files it uploaded itself
 * (for its own workspace), each upload gets a signed token tying the file to the workspace.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

/** Types Baba can work with (documents, spreadsheets, data, images, presentations). */
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/json": "json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function key() {
  const secret = process.env.BABA_UPLOAD_SECRET || process.env.ANTHROPIC_API_KEY;
  if (!secret) throw new Error("No secret available to sign uploads.");
  return createHmac("sha256", "baba-uploads").update(secret).digest();
}

export function signUpload(fileId: string, workspaceId: string) {
  return createHmac("sha256", key()).update(`${fileId}:${workspaceId}`).digest("base64url");
}

export function verifyUpload(fileId: string, workspaceId: string, token: string) {
  const expected = Buffer.from(signUpload(fileId, workspaceId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** A name that is safe as a file path inside the agent's container. */
export function safeFileName(name: string) {
  const cleaned = name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 100);
  return cleaned || "file";
}
