import { Circle, CircleCheck, LoaderCircle } from "lucide-react";
import type { TaskStepStatus } from "@/types/chat";

const labels: Record<TaskStepStatus, string> = {
  done: "Done",
  running: "In progress",
  pending: "Waiting",
};

/** Green check / blue spinner / grey circle, with a hidden text label. */
export function StepStatusIcon({ status, size = "md" }: { status: TaskStepStatus; size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? "size-4" : "size-[18px]";
  return (
    <>
      {status === "done" && <CircleCheck aria-hidden="true" className={`${iconSize} shrink-0 text-success`} />}
      {status === "running" && <LoaderCircle aria-hidden="true" className={`${iconSize} shrink-0 animate-spin text-info`} />}
      {status === "pending" && <Circle aria-hidden="true" className={`${iconSize} shrink-0 text-subtle`} />}
      <span className="sr-only">{labels[status]}: </span>
    </>
  );
}
