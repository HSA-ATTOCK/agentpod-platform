import { CalendarRange, Database, FileText, Globe, Inbox, Mail, Megaphone, MessageSquare, Receipt, Search, ShoppingBag, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { StartState } from "@/lib/data/getting-started";
import { BabaAvatar } from "./baba-avatar";
import { GettingStarted } from "./getting-started";
import { startersFor, type StarterIcon } from "./starters";

const ICONS: Record<StarterIcon, typeof Inbox> = {
  calendar: CalendarRange,
  database: Database,
  file: FileText,
  globe: Globe,
  inbox: Inbox,
  mail: Mail,
  megaphone: Megaphone,
  message: MessageSquare,
  receipt: Receipt,
  search: Search,
  shop: ShoppingBag,
  users: Users,
};

type NewChatProps = {
  /** The message box, rendered large in the middle. */
  composer: ReactNode;
  /** Sends a message straight away (one-click ideas and checklist steps). */
  onSend: (prompt: string) => void;
  /** Connected tools and finished first steps; missing for people who can't give tasks. */
  startState?: StartState;
  workspaceId: string;
};

/** Empty state for a new conversation: greeting, big message box, suggestions. */
export function NewChat({ composer, onSend, startState, workspaceId }: NewChatProps) {
  const ideas = startState ? startersFor(startState.connected, startState.hasDocuments) : [];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 lg:px-8">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center">
        <BabaAvatar size="lg" className="mb-4" />
        <h1 className="mb-2 text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          What can Baba do for you today?
        </h1>
        <p className="mb-8 max-w-lg text-center text-sm text-muted sm:text-base">
          Describe a task in plain language. Baba will plan it, do the work and ask before anything sensitive.
        </p>

        {startState && <GettingStarted state={startState} workspaceId={workspaceId} onSend={onSend} />}

        <div className="w-full max-w-2xl">{composer}</div>

        {ideas.length > 0 && (
        <section aria-labelledby="suggestions-title" className="mt-10 w-full">
          <h2 id="suggestions-title" className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-subtle">
            Try one of these
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ideas.map((suggestion) => {
              const Icon = ICONS[suggestion.icon];
              return (
              <li key={suggestion.title}>
                <button
                  type="button"
                  onClick={() => onSend(suggestion.prompt)}
                  className="flex h-full w-full flex-col gap-1.5 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-raised"
                >
                  <span className="mb-1 flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{suggestion.title}</span>
                  <span className="text-xs text-muted">{suggestion.prompt}</span>
                </button>
              </li>
              );
            })}
          </ul>
        </section>
        )}
      </div>
    </div>
  );
}
