import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "default" | "accent" | "success" | "danger";

const valueColor: Record<StatTone, string> = {
  default: "text-foreground",
  accent: "text-accent",
  success: "text-success",
  danger: "text-danger",
};

type StatCardProps = {
  label: string;
  value: number;
  /** Short supporting text, e.g. "50% of agents". */
  detail?: string;
  tone?: StatTone;
};

/** A single number with a label. */
export function StatCard({ label, value, detail, tone = "default" }: StatCardProps) {
  return (
    <Card className="flex flex-col justify-between p-4">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className={cn("text-2xl font-bold", valueColor[tone])}>
          {value.toLocaleString("en-US")}
        </span>
        {detail && <span className="text-[11px] text-subtle">{detail}</span>}
      </div>
    </Card>
  );
}
