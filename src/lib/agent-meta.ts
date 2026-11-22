import {
  ChartLine,
  FileSpreadsheet,
  Headphones,
  Megaphone,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { AgentCategory } from "@/types";

/** Display label and icon for each agent category. */
export const agentCategoryMeta: Record<AgentCategory, { label: string; icon: LucideIcon }> = {
  sales: { label: "Sales", icon: Target },
  support: { label: "Support", icon: Headphones },
  operations: { label: "Operations", icon: FileSpreadsheet },
  marketing: { label: "Marketing", icon: Megaphone },
  research: { label: "Research", icon: ChartLine },
};
