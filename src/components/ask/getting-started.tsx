"use client";

import { CircleCheck, Circle, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { routes } from "@/config/routes";
import type { StartState } from "@/lib/data/getting-started";

type Step = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  /** Either a message for Baba (sent on click) or a page to open. */
  prompt?: string;
  href?: string;
  action: string;
};

function stepsFor(state: StartState): Step[] {
  const emailConnected = state.connected.includes("google") || state.connected.includes("microsoft");
  const steps: Step[] = [
    {
      id: "memory",
      title: "Tell Baba about your business",
      description: "A few answers about what you sell and who your customers are make every reply fit.",
      done: state.hasMemory,
      prompt:
        "Ask me 5 short questions about my business (what we sell, who our customers are, our prices, our tone of voice and anything you should always remember), one at a time. Then save my answers to business memory.",
      action: "Start",
    },
    {
      id: "connect",
      title: "Connect your email and calendar",
      description: state.isManager ? "So Baba can read, draft and plan with your real inbox and schedule." : "Ask an owner or admin of this workspace to connect them.",
      done: emailConnected,
      ...(state.isManager
        ? { prompt: "I want to connect my email and calendar. Ask me whether I use Gmail or Outlook, then show me the connect button.", action: "Connect" }
        : { href: routes.integrations, action: "View" }),
    },
    {
      id: "documents",
      title: "Add a document",
      description: "Price lists, policies or FAQs. Baba searches them when it answers.",
      done: state.hasDocuments,
      href: routes.memory,
      action: "Add",
    },
    {
      id: "task",
      title: "Give Baba its first task",
      description: "Pick one of the ideas below, or type your own.",
      done: state.hasTasks,
      action: "",
    },
    {
      id: "briefing",
      title: "Turn on your daily briefing",
      description: "A short summary of your day, every morning.",
      done: state.briefingOn,
      href: `${routes.settings}?tab=notifications`,
      action: "Turn on",
    },
  ];
  if (state.isManager) {
    steps.push({
      id: "team",
      title: "Invite a teammate",
      description: "Work on tasks together, each with their own role.",
      done: state.hasTeam,
      href: `${routes.settings}?tab=team`,
      action: "Invite",
    });
  }
  return steps;
}

const KEY_PREFIX = "baba:getting-started-hidden:";
const listeners = new Set<() => void>();

function readHidden(workspaceId: string) {
  try {
    return window.localStorage.getItem(KEY_PREFIX + workspaceId) === "1";
  } catch {
    return false;
  }
}

function hide(workspaceId: string) {
  try {
    window.localStorage.setItem(KEY_PREFIX + workspaceId, "1");
  } catch {
    // Private mode: it stays hidden until the page reloads
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A short checklist for new workspaces. Disappears when everything is done, or when hidden. */
export function GettingStarted({ state, workspaceId, onSend }: { state: StartState; workspaceId: string; onSend: (prompt: string) => void }) {
  // Hidden on the server and until the browser has checked whether it was dismissed
  const hidden = useSyncExternalStore(subscribe, () => readHidden(workspaceId), () => true);
  const steps = stepsFor(state);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;

  return (
    <section aria-labelledby="getting-started-title" className="mb-8 w-full max-w-2xl rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="getting-started-title" className="text-sm font-semibold text-foreground">
            Get started with Baba
          </h2>
          <p className="text-xs text-muted">
            {done} of {steps.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => hide(workspaceId)}
          className="rounded-control p-1 text-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
          aria-label="Hide the getting-started checklist"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 py-2.5">
            {step.done ? (
              <CircleCheck aria-label="Done" className="size-5 shrink-0 text-success" />
            ) : (
              <Circle aria-label="Not done yet" className="size-5 shrink-0 text-subtle" />
            )}
            <div className="min-w-0 flex-1">
              <p className={step.done ? "text-sm text-muted line-through" : "text-sm font-medium text-foreground"}>{step.title}</p>
              {!step.done && <p className="text-xs text-muted">{step.description}</p>}
            </div>
            {!step.done && step.prompt && (
              <button
                type="button"
                onClick={() => onSend(step.prompt!)}
                className="shrink-0 rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-surface-raised"
              >
                {step.action}
              </button>
            )}
            {!step.done && step.href && (
              <Link
                href={step.href}
                className="shrink-0 rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-surface-raised"
              >
                {step.action}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
