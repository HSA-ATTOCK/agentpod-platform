import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/admin-controls";
import { AdminPage } from "@/components/admin/admin-page";
import { requirePlatformAdmin } from "@/lib/platform/admin";

export const metadata: Metadata = { title: "Platform settings" };

async function Content() {
  const ctx = await requirePlatformAdmin();
  const { data: s } = await ctx.db.from("platform_settings").select("*").eq("id", 1).single();
  if (!s) return <p className="text-sm text-danger">Platform settings are missing. Apply the database migrations.</p>;
  return (
    <div className="max-w-2xl">
      <SettingsForm
        requireApproval={s.require_approval}
        maintenanceMode={s.maintenance_mode}
        maintenanceMessage={s.maintenance_message}
        announcement={s.announcement ?? ""}
        defaultMonthlyLimitUsd={Number(s.default_monthly_limit_usd)}
        defaultTaskCapUsd={Number(s.default_task_cap_usd)}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AdminPage title="Platform settings" description="Global switches for the whole platform. Every change is recorded in the audit log.">
      <Content />
    </AdminPage>
  );
}
