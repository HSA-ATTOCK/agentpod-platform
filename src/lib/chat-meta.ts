import {
  Code,
  FileSpreadsheet,
  FileText,
  Files,
  Globe,
  Mail,
  MessageSquare,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import type { ChatFileKind, ChatItem, Conversation, ToolId } from "@/types/chat";

export const toolMeta: Record<ToolId, { label: string; icon: LucideIcon }> = {
  web_search: { label: "Web search", icon: Globe },
  code: { label: "Code", icon: Code },
  gmail: { label: "Gmail", icon: Mail },
  slack: { label: "Slack", icon: MessageSquare },
  files: { label: "Files", icon: Files },
};

export const fileKindMeta: Record<ChatFileKind, { label: string; icon: LucideIcon }> = {
  spreadsheet: { label: "Spreadsheet", icon: FileSpreadsheet },
  document: { label: "Document", icon: FileText },
  presentation: { label: "Presentation", icon: Presentation },
  other: { label: "File", icon: Files },
};

/** Plain-text version of a chat item, used by the Copy button. */
export function itemToPlainText(item: ChatItem): string {
  switch (item.type) {
    case "user":
    case "text":
    case "markdown":
    case "error":
      return item.text;
    case "progress":
      return [item.title, ...item.steps.map((s) => `- ${s.label}`)].join("\n");
    case "answer":
      return item.blocks
        .map((block) => {
          if (block.type === "paragraph" || block.type === "heading") return block.text;
          if (block.type === "list")
            return block.items.map((i) => `- ${i.lead ? `${i.lead} ` : ""}${i.text}`).join("\n");
          return [block.columns, ...block.rows].map((row) => row.join(" | ")).join("\n");
        })
        .join("\n\n");
    default:
      return "";
  }
}

/** Everything the Task details panel shows, worked out from the conversation. */
export function getTaskDetails(conversation: Conversation | null) {
  const items = conversation?.items ?? [];
  const latestProgress = [...items].reverse().find((i) => i.type === "progress");
  return {
    steps: latestProgress?.type === "progress" ? latestProgress.steps : [],
    files: items.flatMap((i) => (i.type === "file" ? [i.file] : [])),
    sources: items.flatMap((i) => (i.type === "sources" ? i.sources : [])),
    tools: conversation?.tools ?? [],
  };
}
