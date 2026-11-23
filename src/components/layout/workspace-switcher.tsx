"use client";

import { Check, ChevronsUpDown, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceRole } from "@/lib/data/context";
import { switchWorkspace } from "@/lib/data/workspace-cookie";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type SwitcherWorkspace = { id: string; name: string; role: WorkspaceRole; logoUrl?: string | null };
export type PendingInvite = { id: string; workspaceName: string; role: WorkspaceRole };

type Props = {
  current: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  invites: PendingInvite[];
};

/** Shows the current workspace; lets people switch workspace and accept invites. */
export function WorkspaceSwitcher({ current, workspaces, invites }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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

  async function accept(invite: PendingInvite) {
    setAccepting(invite.id);
    setError(null);
    const { data, error: acceptError } = await getSupabaseBrowser().rpc("accept_invite", { invite_id: invite.id });
    if (acceptError || !data) {
      setAccepting(null);
      setError("Couldn't accept the invite. It may have expired.");
      return;
    }
    switchWorkspace(data);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Current workspace: ${current.name}. Switch workspace`}
        className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface-raised p-2.5 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent/20 text-xs font-bold text-accent">
            {current.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded workspace logo
              <img src={current.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              current.name[0]?.toUpperCase()
            )}
          </span>
          <span className="truncate text-xs font-semibold text-foreground">{current.name}</span>
        </span>
        <span className="flex items-center gap-1">
          {invites.length > 0 && <span aria-hidden="true" className="size-2 rounded-full bg-accent" />}
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-subtle" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-surface-raised p-1.5 text-sm shadow-xl">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Workspaces</p>
          <ul>
            {workspaces.map((ws) => (
              <li key={ws.id}>
                <button
                  type="button"
                  onClick={() => (ws.id === current.id ? setOpen(false) : switchWorkspace(ws.id))}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left hover:bg-border",
                    ws.id === current.id ? "text-foreground" : "text-muted",
                  )}
                >
                  <span className="min-w-0 truncate">{ws.name}</span>
                  {ws.id === current.id && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />}
                </button>
              </li>
            ))}
          </ul>
          {invites.length > 0 && (
            <>
              <p className="mt-1 border-t border-border px-2.5 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                Invitations
              </p>
              <ul>
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-muted">
                      <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="truncate">{invite.workspaceName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void accept(invite)}
                      disabled={accepting !== null}
                      className="shrink-0 rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-accent-foreground disabled:opacity-50"
                    >
                      {accepting === invite.id ? "Joining…" : "Join"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && <p className="px-2.5 py-1.5 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
