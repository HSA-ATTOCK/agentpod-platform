import "server-only";
import { ACMClient, DescribeCertificateCommand, RequestCertificateCommand } from "@aws-sdk/client-acm";
import { CloudFrontClient, CreateDistributionCommand, CreateInvalidationCommand, GetDistributionCommand } from "@aws-sdk/client-cloudfront";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppContext } from "@/lib/data/context";
import { audit } from "@/lib/platform/account";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { serverOrigin } from "@/lib/origin";
import { withFormEndpoint } from "./forms";
import { contentTypeFor } from "./sites";

/**
 * Production publishing (PRD §9): copies one version of a site to S3 under "<slug>/" and
 * refreshes CloudFront, so it's live at https://<slug>.<SITES_PUBLIC_DOMAIN>.
 * The CloudFront distribution (see infrastructure/terraform) maps each subdomain to its folder.
 * Needs: AWS_REGION, SITES_S3_BUCKET,
 * SITES_CLOUDFRONT_DISTRIBUTION_ID and SITES_PUBLIC_DOMAIN, plus AWS credentials (IAM role or keys).
 * Publishing always needs approval.
 */

export function isProductionConfigured() {
  // AWS credentials come from the standard places: the container's IAM role on AWS (no keys),
  // or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY elsewhere
  return Boolean(
    process.env.AWS_REGION &&
      process.env.SITES_S3_BUCKET &&
      process.env.SITES_CLOUDFRONT_DISTRIBUTION_ID &&
      process.env.SITES_PUBLIC_DOMAIN,
  );
}

export const productionUrl = (slug: string) => `https://${slug}.${process.env.SITES_PUBLIC_DOMAIN}`;

const CACHE: Record<string, string> = { html: "public, max-age=60", xml: "public, max-age=300" };

/** Publishes `version` (default: the version live on the preview link). Returns the live URL. */
export async function publishProduction(ctx: AppContext, siteId: string, version?: number) {
  if (!isProductionConfigured()) {
    throw new Error("Publishing to a real domain isn't set up on this server yet (it needs an AWS account). The preview link keeps working.");
  }
  if (ctx.workspace.role !== "owner" && ctx.workspace.role !== "admin") throw new Error("Only workspace owners and admins can publish a website.");
  const db = getSupabaseAdmin();
  const { data: site } = await db.from("sites").select("id, slug, name, current_version, status, domain_distribution_id").eq("id", siteId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!site) throw new Error("That site wasn't found.");
  const v = version ?? site.current_version;
  const { data: ver } = await db.from("site_versions").select("version, files").eq("site_id", site.id).eq("version", v ?? -1).maybeSingle();
  if (!ver) throw new Error("That version wasn't found.");

  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const bucket = process.env.SITES_S3_BUCKET!;
  const files = (ver.files as string[]) ?? [];
  for (const path of files) {
    const { data } = await db.storage.from("sites").download(`${site.id}/v${ver.version}/${path}`);
    if (!data) throw new Error(`File ${path} is missing from version ${ver.version}.`);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${site.slug}/${path}`,
        // HTML forms post back to Baba (absolute address: the live site is on another domain)
        Body: /\.html?$/i.test(path) ? withFormEndpoint(await data.text(), `${serverOrigin()}/api/forms/${site.slug}`) : new Uint8Array(await data.arrayBuffer()),
        ContentType: contentTypeFor(path) ?? "application/octet-stream",
        CacheControl: CACHE[ext] ?? "public, max-age=86400",
      }),
    );
  }
  const cloudfront = new CloudFrontClient({ region: process.env.AWS_REGION });
  await cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: process.env.SITES_CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: { CallerReference: `${site.id}-${ver.version}-${Date.now()}`, Paths: { Quantity: 1, Items: [`/${site.slug}/*`] } },
    }),
  );
  await invalidateCustomDomain(site.domain_distribution_id);
  const url = productionUrl(site.slug);
  await db
    .from("sites")
    .update({ production_version: ver.version, production_url: url, published_at: new Date().toISOString(), status: "preview" })
    .eq("id", site.id);
  await audit({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    workspaceId: ctx.workspace.id,
    action: "site.published_production",
    targetType: "site",
    targetId: site.id,
    details: { version: ver.version, files: files.length, url },
  });
  return { url, version: ver.version, name: site.name };
}

// ---------------------------------------------------------------------------
// Custom domains: an HTTPS certificate (ACM, us-east-1) and a CloudFront distribution per domain,
// serving the site's folder in the same private bucket. Needs SITES_OAC_ID (from Terraform).
// ---------------------------------------------------------------------------

export type DnsRecord = { type: "CNAME"; name: string; value: string; purpose: string };

const acm = () => new ACMClient({ region: "us-east-1" });
const cloudfront = () => new CloudFrontClient({ region: process.env.AWS_REGION });
export const cleanDomain = (domain: string) => domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
export const isValidDomain = (d: string) => /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d);

/** Step 1: request the certificate and return the DNS record that proves the customer owns the domain. */
export async function requestCustomDomain(ctx: AppContext, siteId: string, domain: string) {
  const clean = cleanDomain(domain);
  if (!isValidDomain(clean)) throw new Error("That isn't a valid domain (e.g. www.example.com).");
  if (process.env.SITES_PUBLIC_DOMAIN && (clean === process.env.SITES_PUBLIC_DOMAIN || clean.endsWith(`.${process.env.SITES_PUBLIC_DOMAIN}`))) {
    throw new Error("Use your own domain, not the shared sites domain.");
  }
  if (!isProductionConfigured() || !process.env.SITES_OAC_ID) throw new Error("Custom domains need the AWS setup (see the deployment guide).");
  const db = getSupabaseAdmin();
  const { data: site } = await db.from("sites").select("id, slug, production_url").eq("id", siteId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!site) throw new Error("That site wasn't found.");
  if (!site.production_url) throw new Error("Publish the site live first, then add your domain.");
  const { data: taken } = await db.from("sites").select("id").eq("custom_domain", clean).neq("id", site.id).maybeSingle();
  if (taken) throw new Error("That domain is already used by another website.");

  const cert = await acm().send(new RequestCertificateCommand({ DomainName: clean, ValidationMethod: "DNS", IdempotencyToken: site.id.replace(/-/g, "").slice(0, 32) }));
  // The validation record appears a few seconds after the request
  let records: DnsRecord[] = [];
  for (let i = 0; i < 6 && records.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const d = await acm().send(new DescribeCertificateCommand({ CertificateArn: cert.CertificateArn }));
    records = (d.Certificate?.DomainValidationOptions ?? []).flatMap((o) =>
      o.ResourceRecord?.Name && o.ResourceRecord.Value ? [{ type: "CNAME" as const, name: o.ResourceRecord.Name, value: o.ResourceRecord.Value, purpose: "Proves you own the domain (keep it: certificates renew with it)" }] : [],
    );
  }
  await db
    .from("sites")
    .update({ custom_domain: clean, domain_status: "validating", domain_cert_arn: cert.CertificateArn ?? null, domain_distribution_id: null, domain_target: null, domain_records: records as unknown as Json })
    .eq("id", site.id);
  await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "site.custom_domain_requested", targetType: "site", targetId: site.id, details: { domain: clean } });
  return records.length
    ? `Add this DNS record at your domain provider:\n${records.map((r) => `${r.type}  ${r.name}  →  ${r.value}`).join("\n")}\nThen click "Check domain" on the Websites page (it can take a few minutes after you add it).`
    : 'The certificate was requested. Click "Check domain" on the Websites page in a minute to see the DNS record to add.';
}

/** Step 2 (repeatable): once the certificate is issued, create the domain's CloudFront distribution; report progress. */
export async function checkCustomDomain(ctx: AppContext, siteId: string) {
  const db = getSupabaseAdmin();
  const { data: site } = await db
    .from("sites")
    .select("id, slug, custom_domain, domain_status, domain_cert_arn, domain_distribution_id, domain_records")
    .eq("id", siteId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  if (!site?.custom_domain || !site.domain_cert_arn) throw new Error("Add a domain first.");
  const records = ((site.domain_records as DnsRecord[] | null) ?? []).filter((r) => r.purpose.startsWith("Proves"));

  if (!site.domain_distribution_id) {
    const d = await acm().send(new DescribeCertificateCommand({ CertificateArn: site.domain_cert_arn }));
    const status = d.Certificate?.Status;
    if (status === "FAILED" || status === "VALIDATION_TIMED_OUT") {
      await db.from("sites").update({ domain_status: "failed" }).eq("id", site.id);
      return "The certificate couldn't be issued (the DNS record wasn't found in time). Remove the domain and add it again.";
    }
    if (status !== "ISSUED") {
      const fresh = (d.Certificate?.DomainValidationOptions ?? []).flatMap((o) =>
        o.ResourceRecord?.Name && o.ResourceRecord.Value ? [{ type: "CNAME" as const, name: o.ResourceRecord.Name, value: o.ResourceRecord.Value, purpose: "Proves you own the domain (keep it: certificates renew with it)" }] : [],
      );
      if (fresh.length && !records.length) await db.from("sites").update({ domain_records: fresh as unknown as Json }).eq("id", site.id);
      return `Waiting for the DNS record that proves you own ${site.custom_domain}:\n${(fresh.length ? fresh : records).map((r) => `${r.type}  ${r.name}  →  ${r.value}`).join("\n")}`;
    }
    // Certificate issued: a distribution that serves only this site's folder
    const out = await cloudfront().send(
      new CreateDistributionCommand({
        DistributionConfig: {
          CallerReference: `${site.id}-${Date.now()}`,
          Comment: `Baba site ${site.slug} (${site.custom_domain})`,
          Enabled: true,
          Aliases: { Quantity: 1, Items: [site.custom_domain] },
          DefaultRootObject: "index.html",
          PriceClass: "PriceClass_100",
          HttpVersion: "http2and3",
          Origins: {
            Quantity: 1,
            Items: [
              {
                Id: "site",
                DomainName: `${process.env.SITES_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
                OriginPath: `/${site.slug}`,
                OriginAccessControlId: process.env.SITES_OAC_ID,
                S3OriginConfig: { OriginAccessIdentity: "" },
              },
            ],
          },
          DefaultCacheBehavior: {
            TargetOriginId: "site",
            ViewerProtocolPolicy: "redirect-to-https",
            Compress: true,
            AllowedMethods: { Quantity: 2, Items: ["GET", "HEAD"], CachedMethods: { Quantity: 2, Items: ["GET", "HEAD"] } },
            // AWS managed: CachingOptimized, SecurityHeadersPolicy
            CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
            ResponseHeadersPolicyId: "67f7725c-6f97-4210-82d7-5512b31e9d03",
          },
          CustomErrorResponses: {
            Quantity: 1,
            Items: [{ ErrorCode: 403, ResponsePagePath: "/404.html", ResponseCode: "404", ErrorCachingMinTTL: 60 }],
          },
          ViewerCertificate: { ACMCertificateArn: site.domain_cert_arn, SSLSupportMethod: "sni-only", MinimumProtocolVersion: "TLSv1.2_2021" },
        },
      }),
    );
    const target = out.Distribution?.DomainName ?? "";
    const all: DnsRecord[] = [...records, { type: "CNAME", name: site.custom_domain, value: target, purpose: "Points your domain at the website" }];
    await db.from("sites").update({ domain_status: "deploying", domain_distribution_id: out.Distribution?.Id ?? null, domain_target: target, domain_records: all as unknown as Json }).eq("id", site.id);
    await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "site.custom_domain_deploying", targetType: "site", targetId: site.id, details: { domain: site.custom_domain } });
    return `Certificate issued. Now add (or change) this DNS record:\nCNAME  ${site.custom_domain}  →  ${target}\nThe domain goes live within about 15 minutes.`;
  }

  const dist = await cloudfront().send(new GetDistributionCommand({ Id: site.domain_distribution_id }));
  if (dist.Distribution?.Status === "Deployed") {
    if (site.domain_status !== "live") {
      await db.from("sites").update({ domain_status: "live" }).eq("id", site.id);
      await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "site.custom_domain_live", targetType: "site", targetId: site.id, details: { domain: site.custom_domain } });
    }
    return `https://${site.custom_domain} is set up. If it doesn't open yet, check the CNAME record ${site.custom_domain} → ${dist.Distribution.DomainName}.`;
  }
  return `Almost there: AWS is still setting up ${site.custom_domain} (usually 5–15 minutes). Make sure this DNS record exists: CNAME ${site.custom_domain} → ${dist.Distribution?.DomainName}.`;
}

/** Refreshes a site's own-domain distribution after publishing. */
export async function invalidateCustomDomain(distributionId: string | null) {
  if (!distributionId) return;
  await cloudfront()
    .send(new CreateInvalidationCommand({ DistributionId: distributionId, InvalidationBatch: { CallerReference: `${distributionId}-${Date.now()}`, Paths: { Quantity: 1, Items: ["/*"] } } }))
    .catch((error) => console.error("[sites] custom domain refresh failed:", error instanceof Error ? error.message : error));
}
