/**
 * Shapes of the real data the app pages show (loaded on the server from Supabase,
 * passed to the page components). Dates are ISO 8601 strings; money is in US cents.
 */
import type { WorkspaceRole } from "@/lib/data/context";

export type TaskStatus = "running" | "succeeded" | "failed" | "paused" | "needs_approval";

export type TaskStep = {
  id: string;
  label: string;
  agent?: string;
  status: "running" | "done" | "failed";
  at: string;
};

export type FileRecord = {
  id: string;
  name: string;
  kind: "document" | "spreadsheet" | "presentation" | "website" | "app" | "other";
  sizeBytes: number;
  createdAt: string;
  conversationId: string | null;
  conversationTitle: string | null;
  /** Null when the conversation it came from was deleted. */
  downloadUrl: string | null;
};

export type TaskRecord = {
  id: string;
  request: string;
  status: TaskStatus;
  agents: string[];
  error: string | null;
  costCents: number;
  capCents: number | null;
  startedAt: string;
  finishedAt: string | null;
  conversationId: string | null;
  steps: TaskStep[];
  files: FileRecord[];
};

export type WorkflowRecord = {
  id: string;
  name: string;
  instruction: string;
  frequency: "manual" | "daily" | "weekly" | "monthly";
  dayOfWeek: number | null;
  timeOfDay: string | null;
  capUsd: number;
  enabled: boolean;
  createdBy: string | null;
  /** A secret webhook link can start it (only a hash is stored). */
  hasWebhook: boolean;
  /** Ordered steps (do / check / ask me first / notify me). */
  steps: import("@/lib/workflows/steps").WorkflowStep[];
  runs: { status: TaskStatus; startedAt: string; costCents: number; error: string | null; conversationId: string | null }[];
};

export type MemberRecord = {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  avatarUrl: string | null;
};

export type InviteRecord = {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
  expiresAt: string;
};

export type WorkspaceSettings = {
  id: string;
  name: string;
  industry: string | null;
  companySize: string | null;
  timezone: string;
  taskCapUsd: number;
  monthlyLimitUsd: number;
  businessContext: string;
  logoUrl: string | null;
};

export type ProfileRecord = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  phone: string | null;
  language: string;
  timezone: string;
  createdAt: string;
  avatarUrl: string | null;
};

/** Which Claude model the agents run on, from BABA_PROFILE. */
export type ModelInfo = { label: string; testMode: boolean };
