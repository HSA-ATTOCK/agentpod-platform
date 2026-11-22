import type { Metadata } from "next";
import { SettingsView } from "@/components/pages/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  // Show the spending cap and profile Baba really uses (server settings, never secrets)
  const cap = Number(process.env.BABA_SESSION_BUDGET_USD ?? "1");
  const currentCapUsd = (Number.isFinite(cap) && cap > 0 ? cap : 1).toFixed(2);
  const profile = process.env.BABA_PROFILE === "test" ? "test" : "normal";
  return <SettingsView currentCapUsd={currentCapUsd} profile={profile} />;
}
