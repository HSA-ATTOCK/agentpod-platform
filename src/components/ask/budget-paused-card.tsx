import { CirclePause, CirclePlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatItem } from "@/types/chat";

type BudgetPausedItem = Extract<ChatItem, { type: "budget_paused" }>;

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type BudgetPausedCardProps = {
  item: BudgetPausedItem;
  cost?: { cents: number; capCents: number | null };
  /** True while Baba is working (Continue is disabled). */
  busy: boolean;
  onContinue: () => void;
};

/** Shown when a conversation reaches its spending cap. Continue picks up the same task. */
export function BudgetPausedCard({ item, cost, busy, onContinue }: BudgetPausedCardProps) {
  if (item.status === "resumed") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted">
        <CirclePlay aria-hidden="true" className="size-4 text-success" />
        Continued — Baba picked up where it stopped.
      </p>
    );
  }

  return (
    <section
      aria-label="Paused at spending cap"
      className="relative overflow-hidden rounded-card border border-warning/30 bg-warning/10 p-4"
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-warning" />
      <div className="flex flex-col gap-3 pl-2">
        <div className="flex items-start gap-2.5">
          <CirclePause aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Paused at the spending cap</h3>
            <p className="mt-1 text-sm text-muted">
              {cost
                ? `This task has used ${formatUsd(cost.cents)}${cost.capCents !== null ? ` of its ${formatUsd(cost.capCents)} cap` : ""}. `
                : "This task reached its spending cap. "}
              Everything Baba has done so far is saved. Continue to raise the cap and let Baba finish from exactly
              where it stopped — nothing is redone or charged twice.
            </p>
          </div>
        </div>
        <div>
          <Button onClick={onContinue} disabled={busy}>
            <CirclePlay aria-hidden="true" className="size-4" />
            Continue task
          </Button>
        </div>
      </div>
    </section>
  );
}
