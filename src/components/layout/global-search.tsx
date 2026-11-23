"use client";

import { FileText, MessageSquare, Repeat, Search, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { routes } from "@/config/routes";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Result = { id: string; kind: "Conversation" | "Task" | "File" | "Workflow"; label: string; href: string };

const icons: Record<Result["kind"], LucideIcon> = {
  Conversation: MessageSquare,
  Task: MessageSquare,
  File: FileText,
  Workflow: Repeat,
};

/** Escape characters that have a meaning in a Postgres ILIKE pattern. */
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function search(workspaceId: string, text: string): Promise<Result[]> {
  const supabase = getSupabaseBrowser();
  const pattern = likePattern(text);
  const [conversations, tasks, files, workflows] = await Promise.all([
    supabase.from("conversations").select("id, title").eq("workspace_id", workspaceId).ilike("title", pattern).order("updated_at", { ascending: false }).limit(5),
    supabase.from("tasks").select("id, request, conversation_id").eq("workspace_id", workspaceId).ilike("request", pattern).order("started_at", { ascending: false }).limit(5),
    supabase.from("files").select("id, name, conversation_id").eq("workspace_id", workspaceId).ilike("name", pattern).order("created_at", { ascending: false }).limit(5),
    supabase.from("workflows").select("id, name").eq("workspace_id", workspaceId).ilike("name", pattern).limit(5),
  ]);
  const seenConversations = new Set((conversations.data ?? []).map((c) => c.id));
  return [
    ...(conversations.data ?? []).map((c) => ({ id: `c-${c.id}`, kind: "Conversation" as const, label: c.title, href: `${routes.ask}?c=${c.id}` })),
    ...(tasks.data ?? [])
      .filter((t) => !t.conversation_id || !seenConversations.has(t.conversation_id))
      .map((t) => ({
        id: `t-${t.id}`,
        kind: "Task" as const,
        label: t.request,
        href: t.conversation_id ? `${routes.ask}?c=${t.conversation_id}` : routes.activity,
      })),
    ...(files.data ?? []).map((f) => ({ id: `f-${f.id}`, kind: "File" as const, label: f.name, href: routes.projects })),
    ...(workflows.data ?? []).map((w) => ({ id: `w-${w.id}`, kind: "Workflow" as const, label: w.name, href: routes.workflows })),
  ];
}

/** Searches conversations, tasks, files and workflows in this workspace. ⌘K / Ctrl+K focuses it. */
export function GlobalSearch({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search as you type (debounced)
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      search(workspaceId, text)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setHighlight(0);
        })
        .catch(() => !cancelled && setResults([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, workspaceId]);

  const shown = query.trim().length >= 2 ? results : null;

  function go(result: Result) {
    setOpen(false);
    setQuery("");
    setResults(null);
    inputRef.current?.blur();
    router.push(result.href);
  }

  return (
    <div role="search" className="relative w-full max-w-96">
      <label htmlFor="app-search" className="sr-only">
        Search conversations, tasks, files and workflows
      </label>
      <Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        id="app-search"
        type="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && shown !== null}
        aria-controls={listId}
        aria-activedescendant={shown?.[highlight] ? `${listId}-${highlight}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!shown?.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % shown.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + shown.length) % shown.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(shown[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search chats, tasks, files…"
        className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-14 text-sm text-foreground placeholder:text-subtle transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-subtle">
        ⌘K
      </kbd>

      {open && shown !== null && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-2xl"
        >
          {shown.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-subtle">No results for &ldquo;{query.trim()}&rdquo;</li>
          ) : (
            shown.map((result, i) => {
              const Icon = icons[result.kind];
              return (
                <li
                  key={result.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(result);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-sm",
                    i === highlight ? "bg-surface-raised text-foreground" : "text-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate">{result.label}</span>
                  <span className="shrink-0 text-[11px] text-subtle">{result.kind}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
