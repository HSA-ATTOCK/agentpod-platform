/**
 * Core Baba domain types.
 * These mirror the future Supabase tables, so the UI built with sample data
 * in Phase 1 keeps working when real data arrives in Phase 2+.
 */

export type Workspace = {
  id: string;
  name: string;
  slug: string;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
};

export type AgentStatus = "active" | "paused" | "draft" | "error";

export type AgentCategory =
  | "sales"
  | "support"
  | "operations"
  | "marketing"
  | "research";

export type Agent = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: AgentCategory;
  status: AgentStatus;
  /** ISO 8601 timestamp, or null if the agent has never run */
  lastActiveAt: string | null;
};

export type WorkflowStatus = "active" | "paused" | "draft";

export type Workflow = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  lastRunAt: string | null;
  runCount: number;
};

export type IntegrationStatus = "not_connected" | "connected" | "error";

export type Integration = {
  id: string;
  name: string;
  description: string;
  category: "email" | "storage" | "communication" | "crm" | "productivity" | "developer";
  status: IntegrationStatus;
  /** False for integrations planned but not yet available */
  available: boolean;
};

export type ExecutionStatus = "queued" | "running" | "succeeded" | "failed";

export type Execution = {
  id: string;
  workspaceId: string;
  taskName: string;
  agentId: string;
  agentName: string;
  status: ExecutionStatus;
  startedAt: string;
  durationMs: number | null;
  resultSummary: string;
};

export type ActivityEventTone = "success" | "warning" | "danger" | "info" | "neutral";

export type ActivityEvent = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  tone: ActivityEventTone;
  occurredAt: string;
};
