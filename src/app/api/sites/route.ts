import { canManage, getAppContext } from "@/lib/data/context";
import { publishProduction, requestCustomDomain } from "@/lib/sites/production";
import { deleteSite, restoreSiteVersion, setSiteStatus } from "@/lib/sites/sites";
import { isAdminConfigured } from "@/lib/supabase/admin";

/**
 * POST /api/sites — body: { action: "restore" | "disable" | "enable" | "delete", siteId, version? }
 * Owners and admins only.
 */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canManage(ctx.workspace.role)) return Response.json({ error: "Only owners and admins can manage websites." }, { status: 403 });
  if (!isAdminConfigured()) return Response.json({ error: "Website previews aren't set up on this server." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; siteId?: string; version?: number; domain?: string };
  const siteId = typeof body.siteId === "string" ? body.siteId : "";
  try {
    switch (body.action) {
      case "restore":
        await restoreSiteVersion(ctx, siteId, Number(body.version));
        break;
      case "disable":
        await setSiteStatus(ctx, siteId, "disabled");
        break;
      case "enable":
        await setSiteStatus(ctx, siteId, "preview");
        break;
      case "delete":
        await deleteSite(ctx, siteId);
        break;
      case "publish": {
        const live = await publishProduction(ctx, siteId, body.version ? Number(body.version) : undefined);
        return Response.json({ ok: true, url: live.url });
      }
      case "domain":
        return Response.json({ ok: true, message: await requestCustomDomain(ctx, siteId, String(body.domain ?? "")) });
      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "That didn't work." }, { status: 400 });
  }
}
