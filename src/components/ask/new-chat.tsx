import { CalendarRange, ChartColumn, Inbox, Mail, NotebookText, Search } from "lucide-react";
import type { ReactNode } from "react";
import { BabaAvatar } from "./baba-avatar";

export const suggestions = [
  { icon: Search, title: "Research competitors", prompt: "Compare our top 3 competitors on pricing and features" },
  { icon: Mail, title: "Draft follow-up emails", prompt: "Write follow-ups for everyone who attended yesterday's webinar" },
  { icon: ChartColumn, title: "Analyze a spreadsheet", prompt: "Find trends and problems in this month's sales data" },
  { icon: NotebookText, title: "Weekly report", prompt: "Summarize this week's support tickets into a short report" },
  { icon: CalendarRange, title: "Plan a campaign", prompt: "Plan a 4-week product launch campaign" },
  { icon: Inbox, title: "Triage the inbox", prompt: "Sort new support emails by urgency and draft replies" },
];

type NewChatProps = {
  /** The message box, rendered large in the middle. */
  composer: ReactNode;
  onPickSuggestion: (prompt: string) => void;
};

/** Empty state for a new conversation: greeting, big message box, suggestions. */
export function NewChat({ composer, onPickSuggestion }: NewChatProps) {
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

        <div className="w-full max-w-2xl">{composer}</div>

        <section aria-labelledby="suggestions-title" className="mt-10 w-full">
          <h2 id="suggestions-title" className="sr-only">
            Suggestions
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((suggestion) => (
              <li key={suggestion.title}>
                <button
                  type="button"
                  onClick={() => onPickSuggestion(suggestion.prompt)}
                  className="flex h-full w-full flex-col gap-1.5 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-raised"
                >
                  <span className="mb-1 flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <suggestion.icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{suggestion.title}</span>
                  <span className="text-xs text-muted">{suggestion.prompt}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
