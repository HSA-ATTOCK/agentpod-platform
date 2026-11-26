# Deployment guide

Three ways to run Baba, from simplest to fullest. All use your existing Supabase project as the database.

| Option | Good for | Live customer websites |
|---|---|---|
| A. GitHub Codespace / any server with Node 22 | Development, early testing | Preview links only |
| B. Docker on any host | A single server (VPS) | Preview links (or AWS sites, part C3) |
| C. AWS with Terraform | Production | Yes: `https://<site>.<sites-domain>` |

Before any of them:

1. Apply the database migrations (`supabase/migrations/`, in order) to your Supabase project. They are already applied to the current project.
2. Fill in the server settings (copy `.env.example`). Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL`, a long random `INTEGRATIONS_ENCRYPTION_KEY`, Gmail settings for email.
3. Run `npm run baba:setup` once (creates or updates the agents on Claude; prints `BABA_AGENT_ID` and `BABA_ENVIRONMENT_ID`).
4. Make yourself master admin: `npm run admin:bootstrap -- you@example.com` (after signing up).

## A. Node directly

```bash
npm ci
npm run build
npm start
```

Set `BABA_ALLOW_PUBLIC=true` in production so approved users can use Baba.

## B. Docker

```bash
docker compose up --build -d
```

`docker-compose.yml` reads `.env.production`. The image runs as a non-root user, has a health check on `/api/health`, and is about 200 MB. The `NEXT_PUBLIC_*` values are built into the browser code, so rebuild the image when they change.

## C. AWS (Terraform)

What gets created (`infrastructure/terraform`, validated with Terraform 1.9 + AWS provider 5.80):

- **App:** ECR image repository, ECS Fargate service behind an HTTPS Application Load Balancer (HTTP → HTTPS redirect, health checks, automatic rollback of unhealthy deployments), CloudWatch logs (30 days), alarms for unhealthy containers and error spikes.
- **Secrets:** one Secrets Manager secret (JSON) holding all server keys; the containers read it at start. Terraform never stores the values.
- **Live websites:** private, encrypted, versioned S3 bucket; CloudFront with a wildcard certificate for `*.<sites-domain>` and a small function that maps each subdomain to its site's folder; the app's IAM role may only write that bucket and refresh CloudFront (no AWS keys in the app).

### C1. Create the infrastructure

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in region and domains
terraform init
terraform apply
```

If your domain isn't in Route 53, leave `route53_zone_id` empty and add the DNS records printed in the outputs (`certificate_dns_records`, then CNAMEs for `app_domain` → `load_balancer_dns` and `*.sites_domain` → `sites_cloudfront_domain`). Run `terraform apply` again after the certificates are issued.

Use separate state (and a different `environment` value) for staging and production.

### C2. Put your settings in Secrets Manager

In the AWS console open the secret named in the `app_secret_name` output and store a JSON object with the keys listed in `app.tf` (`SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `BABA_AGENT_ID`, …). Optional ones can be left out.

### C3. Deploy

One-time GitHub setup:

- Create an IAM role that GitHub Actions can assume through OIDC, allowed to push to the ECR repository and to call `ecs:UpdateService` / `ecs:DescribeServices` on the cluster. Save its ARN as the repository secret `AWS_DEPLOY_ROLE_ARN`.
- Repository variables: `AWS_REGION`, `ECR_REPOSITORY_URL`, `ECS_CLUSTER` (from the outputs), `APP_URL` (e.g. `https://app.example.com`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Then: GitHub → Actions → **Deploy to AWS** → Run workflow. It builds the image, pushes it, rolls out, waits until healthy and checks `/api/health`.

### C4. After the first deploy

- Supabase → Authentication → URL configuration: set the site URL and add `https://<app-domain>/auth/callback` to the redirect URLs.
- Google / Slack / HubSpot / Microsoft apps: their redirect addresses now use your app domain (the setup cards show the exact address).
- Stripe: add the webhook `https://<app-domain>/api/billing/webhook` (see `.env.example`).
- Scheduled workflows run inside the app. With more than one container they're still claimed once per slot.

## Health and monitoring

- `GET /api/health` returns 200 when the app and database answer (used by the load balancer and the Docker health check).
- Server errors are logged as one JSON line each (`"level":"error"`); CloudWatch counts them and alarms above 10 in 5 minutes. Set `ALERT_WEBHOOK_URL` (e.g. a Slack incoming webhook) to get a message for each error.
- Admin → System health shows the state of every dependency.

## Load testing

```bash
npm run test:load -- https://app.example.com 20 30
```

Hits public pages and the health check (never the AI, which would cost money). Measured on a small dev container: about 620 requests/second at 20 concurrent users, p99 59 ms, no errors.
