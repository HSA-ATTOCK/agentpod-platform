"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

type ImageUploadProps = {
  /** Supabase Storage bucket ("avatars" or "logos"). */
  bucket: "avatars" | "logos";
  /** Folder inside the bucket: the user id (avatars) or workspace id (logos). */
  folder: string;
  hasImage: boolean;
  /** Called with the new public URL, or null when the image is removed. */
  onChange: (url: string | null) => Promise<void>;
  onError: (message: string) => void;
  label: string;
  disabled?: boolean;
};

/** "Upload / Remove" buttons for a small public image (PNG, JPG or WebP up to 2 MB). */
export function ImageUpload({ bucket, folder, hasImage, onChange, onError, label, disabled }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!TYPES.includes(file.type)) return onError("Choose a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) return onError("That image is over 2 MB. Choose a smaller one.");
    setBusy(true);
    const storage = getSupabaseBrowser().storage.from(bucket);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    // A new name each time, so browsers don't keep showing a cached old image
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) {
      setBusy(false);
      return onError("Couldn't upload the image. Please try again.");
    }
    // Tidy up older images in this folder
    const { data: existing } = await storage.list(folder);
    const old = (existing ?? []).map((f) => `${folder}/${f.name}`).filter((p) => p !== path);
    if (old.length) await storage.remove(old);
    await onChange(storage.getPublicUrl(path).data.publicUrl);
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const storage = getSupabaseBrowser().storage.from(bucket);
    const { data: existing } = await storage.list(folder);
    if (existing?.length) await storage.remove(existing.map((f) => `${folder}/${f.name}`));
    await onChange(null);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={TYPES.join(",")}
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button size="sm" variant="secondary" disabled={disabled} loading={busy} loadingText="Uploading…" onClick={() => inputRef.current?.click()}>
        {hasImage ? "Change" : "Upload"}
      </Button>
      {hasImage && !busy && (
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void remove()}>
          Remove
        </Button>
      )}
      <span className="text-xs text-subtle">PNG, JPG or WebP, up to 2 MB</span>
    </div>
  );
}
