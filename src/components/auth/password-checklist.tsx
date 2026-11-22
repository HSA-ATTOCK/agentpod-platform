import { Circle, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { passwordRules } from "@/lib/validation";

/** Live list of password requirements that tick off as the user types. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="space-y-1.5 rounded-lg border border-border bg-surface-raised p-2.5 text-xs">
      {passwordRules.map((rule) => {
        const passed = rule.test(password);
        const Icon = passed ? CircleCheck : Circle;
        return (
          <li
            key={rule.id}
            className={cn("flex items-center gap-1.5 transition-colors", passed ? "text-success" : "text-subtle")}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span>{rule.label}</span>
            <span className="sr-only">{passed ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
