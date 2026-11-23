"use client";

import { BookOpen, Brain, Check, FileText, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, inputClasses, selectClasses } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { useToast } from "@/components/ui/toast";

export type MemoryRow = { id: string; category: string; content: string; source: string; updated_at: string };
export type DocumentRow = { id: string; title: string; file_name: string | null; char_count: number; chunk_count: number; created_at: string };

const CATEGORIES = [
  ["company", "Company"],
  ["brand", "Brand"],
  ["products", "Products & services"],
  ["audience", "Audience"],
  ["policy", "Policies"],
  ["style", "Writing style"],
  ["fact", "Fact"],
  ["other", "Other"],
] as const;
const categoryLabel = (key: string) => CATEGORIES.find(([k]) => k === key)?.[1] ?? key;

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, body instanceof FormData ? { method, body } : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "That didn't work.");
  return data;
}

export function MemoryView({ memory, documents, canEdit }: { memory: MemoryRow[]; documents: DocumentRow[]; canEdit: boolean }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState({ category: "company", content: "" });
  const [doc, setDoc] = useState({ title: "", text: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      showToast(done);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function addEntry(e: FormEvent) {
    e.preventDefault();
    if (await run("add", () => call("/api/memory", "POST", entry), "Saved to memory.")) setEntry({ ...entry, content: "" });
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await run("upload", () => call("/api/knowledge", "POST", form), `Added "${file.name}" to the knowledge base.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addText(e: FormEvent) {
    e.preventDefault();
    if (await run("paste", () => call("/api/knowledge", "POST", doc), "Document added.")) setDoc({ title: "", text: "" });
  }

  return (
    <div className="space-y-8">
      {toast}
      {error && <Alert variant="error">{error}</Alert>}

      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Brain aria-hidden="true" className="size-4 text-accent" /> Business memory
          </h2>
          <p className="text-sm text-muted">
            Short facts Baba reuses in every new conversation, so you don&apos;t repeat yourself. Facts Baba suggests stay marked until you confirm them.
          </p>
        </div>
        {canEdit && (
          <Card className="p-4">
            <form onSubmit={addEntry} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block space-y-1.5 sm:w-48">
                <span className="text-sm font-medium text-foreground">Category</span>
                <select className={selectClasses} value={entry.category} onChange={(e) => setEntry({ ...entry, category: e.target.value })}>
                  {CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex-1">
                <Input id="memory-content" label="What should Baba remember?" placeholder="e.g. Our brand colours are navy #0B2545 and gold #E0A458" value={entry.content} onChange={(e) => setEntry({ ...entry, content: e.target.value })} />
              </div>
              <Button type="submit" loading={busy === "add"} disabled={!entry.content.trim()}>
                Add
              </Button>
            </form>
          </Card>
        )}
        {memory.length === 0 ? (
          <EmptyState icon={Brain} title="Nothing remembered yet" description="Add facts above, or tell Baba in a chat (“remember that our audience is small clinics”)." />
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {memory.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge>{categoryLabel(m.category)}</Badge>
                    {m.source === "baba" && <Badge tone="warning">Suggested by Baba — not confirmed</Badge>}
                  </div>
                  <p className="text-sm text-foreground">{m.content}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    {m.source === "baba" && (
                      <Button size="sm" variant="secondary" loading={busy === `ok-${m.id}`} onClick={() => run(`ok-${m.id}`, () => call("/api/memory", "POST", { id: m.id, category: m.category, content: m.content }), "Confirmed.")}>
                        <Check aria-hidden="true" className="size-3.5" /> Confirm
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label="Delete" loading={busy === `del-${m.id}`} onClick={() => run(`del-${m.id}`, () => call("/api/memory", "DELETE", { id: m.id }), "Deleted.")}>
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BookOpen aria-hidden="true" className="size-4 text-accent" /> Knowledge base
          </h2>
          <p className="text-sm text-muted">
            Policies, SOPs, product catalogues, price lists, FAQs. Baba searches these when you ask about your own business and says which document it used.
          </p>
        </div>
        {canEdit && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3 p-4">
              <p className="text-sm font-medium text-foreground">Upload a text file</p>
              <p className="text-xs text-muted">TXT, Markdown, CSV, JSON or HTML, up to 5 MB.</p>
              <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.yaml,.yml,text/*" className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border file:border-border file:bg-surface-raised file:px-3 file:py-1.5 file:text-foreground" aria-label="Choose a file" />
              <Button size="sm" loading={busy === "upload"} onClick={upload}>
                <Upload aria-hidden="true" className="size-3.5" /> Add to knowledge base
              </Button>
            </Card>
            <Card className="p-4">
              <form onSubmit={addText} className="space-y-3">
                <Input id="doc-title" label="Or paste text — title" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} placeholder="e.g. Refund policy" />
                <textarea aria-label="Document text" rows={4} className={inputClasses} value={doc.text} onChange={(e) => setDoc({ ...doc, text: e.target.value })} placeholder="Paste the text (e.g. from a PDF or Word document)" />
                <Button type="submit" size="sm" loading={busy === "paste"} disabled={!doc.text.trim()}>
                  Add
                </Button>
              </form>
            </Card>
          </div>
        )}
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Add your first document above." />
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted">
                    {d.file_name ? `${d.file_name} · ` : ""}
                    {d.char_count.toLocaleString()} characters · {d.chunk_count} parts · added <LocalTime iso={d.created_at} format="date" />
                  </p>
                </div>
                {canEdit && (
                  <Button size="sm" variant="ghost" aria-label={`Delete ${d.title}`} loading={busy === `doc-${d.id}`} onClick={() => run(`doc-${d.id}`, () => call("/api/knowledge", "DELETE", { id: d.id }), "Document deleted.")}>
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
