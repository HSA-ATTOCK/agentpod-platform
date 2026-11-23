"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LocalTime } from "@/components/ui/local-time";
import { routes } from "@/config/routes";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Note = { id: string; title: string; text: string; at: string; href: string; tone: "success" | "danger" | "warning" };

const SEEN_KEY = "baba:notifications-seen";

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Bell menu: finished, failed and paused tasks from the last 7 days. */
export function NotificationsMenu({ workspaceId, className }: { workspaceId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [seen, setSeen] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    getSupabaseBrowser()
      .from("tasks")
      .select("id, request, status, started_at, finished_at, conversation_id")
      .eq("workspace_id", workspaceId)
      .in("status", ["succeeded", "failed", "paused"])
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (cancelled) return;
        setSeen(readSeen());
        setNotes(
          (data ?? []).map((t) => ({
            id: t.id,
            title: t.status === "succeeded" ? "Task finished" : t.status === "failed" ? "Task failed" : "Paused at spending cap",
            text: t.request,
            at: t.finished_at ?? t.started_at,
            href: t.conversation_id ? `${routes.ask}?c=${t.conversation_id}` : routes.activity,
            tone: t.status === "succeeded" ? "success" : t.status === "failed" ? "danger" : "warning",
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = (notes ?? []).filter((n) => n.at > seen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && notes?.length) {
      const latest = notes[0].at;
      try {
        localStorage.setItem(SEEN_KEY, latest);
      } catch {
        // private mode: the dot just won't remember
      }
      setSeen(latest);
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Notifications (${unread} new)` : "Notifications"}
        className="relative flex size-10 items-center justify-center rounded-control border border-border bg-surface text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unread > 0 && <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-accent" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-1.5 shadow-2xl">
          <p className="px-3 py-2 text-xs font-semibold text-foreground">Notifications</p>
          {!notes ? (
            <p className="px-3 py-6 text-center text-sm text-subtle">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-subtle">Nothing new in the last 7 days.</p>
          ) : (
            <ul>
              {notes.map((note) => (
                <li key={note.id}>
                  <Link href={note.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-control px-3 py-2.5 hover:bg-surface-raised">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        note.tone === "success" ? "bg-success" : note.tone === "danger" ? "bg-danger" : "bg-warning",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-foreground">{note.title}</span>
                      <span className="block truncate text-xs text-muted">{note.text}</span>
                      <LocalTime iso={note.at} format="relative" className="block text-[11px] text-subtle" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={routes.activity} onClick={() => setOpen(false)} className="block border-t border-border px-3 py-2.5 text-center text-xs font-medium text-accent hover:underline">
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}
