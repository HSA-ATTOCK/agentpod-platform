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

Cost at the default size (1 container, 1 vCPU, 2 GB), roughly: US$60–80 a month (load balancer, container, public IP addresses, logs, secrets), plus about US$15 a year for a .com domain. Live customer websites add a little for storage and CloudFront traffic.

### C0. One-time preparation

1. **Domain.** In the AWS console: Route 53 → Registered domains → Register domain. Buying it in Route 53 creates its hosted zone, so DNS and HTTPS certificates are set up automatically. Note the hosted zone ID (Route 53 → Hosted zones → your domain).
2. **Tools in the Codespace** (terminal):
   ```bash
   curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli.zip && unzip -q /tmp/awscli.zip -d /tmp && sudo /tmp/aws/install
   curl -fsSL https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_amd64.zip -o /tmp/tf.zip && sudo unzip -oq /tmp/tf.zip -d /usr/local/bin
   ```
3. **Sign in the AWS CLI.** In the console, IAM → Users → Create user `baba-setup` with the AdministratorAccess policy → Security credentials → Create access key (Command Line Interface). Then run `aws configure` in the Codespace and paste the key there (never into a chat), region `us-east-1`. Delete this access key when the setup is done.
4. **A bucket for Terraform's state** (so it isn't lost with the Codespace):
   ```bash
   STATE_BUCKET="baba-tfstate-$(aws sts get-caller-identity --query Account --output text)"
   aws s3api create-bucket --bucket "$STATE_BUCKET" --region us-east-1
   aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" --versioning-configuration Status=Enabled
   aws s3api put-public-access-block --bucket "$STATE_BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```

### C1. Create the infrastructure

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in the domains and the hosted zone ID
terraform init -backend-config="bucket=$STATE_BUCKET" -backend-config="key=baba/production.tfstate" -backend-config="region=us-east-1"
terraform apply
```

It takes 10–20 minutes (certificates and CloudFront are the slow parts). The app service starts without an image; that's expected until the first deploy (C3).

If your domain isn't in Route 53, leave `route53_zone_id` empty and add the DNS records printed in the outputs (`certificate_dns_records`, then CNAMEs for `app_domain` → `load_balancer_dns` and `*.sites_domain` → `sites_cloudfront_domain`). Run `terraform apply` again after the certificates are issued.

If the account already has GitHub's OIDC provider (`token.actions.githubusercontent.com` under IAM → Identity providers), set `create_github_oidc_provider = false`.

Use separate state (and a different `environment` value) for staging and production.

### C2. Put your settings in Secrets Manager

AWS console → Secrets Manager → `baba/production/app` (the `app_secret_name` output) → Retrieve secret value → Set secret value → Plaintext, and paste a JSON object with your values from `.env.local`:

```json
{
  "SUPABASE_SECRET_KEY": "…",
  "ANTHROPIC_API_KEY": "…",
  "BABA_AGENT_ID": "…",
  "BABA_ENVIRONMENT_ID": "…",
  "INTEGRATIONS_ENCRYPTION_KEY": "…",
  "GMAIL_USER": "…",
  "GMAIL_APP_PASSWORD": "…"
}
```

All seven are required: **the container won't start if one is missing**. Use the same `INTEGRATIONS_ENCRYPTION_KEY` as in `.env.local`, or connected tools stop working. Optional ones: add them to the JSON, list their names in `optional_secret_keys` in `terraform.tfvars`, and run `terraform apply` again.

- Copy these too if they're set in your `.env.local`: `BABA_PROFILE` (the AI model level; it must match the one `npm run baba:setup` was last run with), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (a platform-wide Google app; Google accounts connected through it stop refreshing without them), `EMAIL_FROM_NAME`, `CONTACT_EMAIL`.
- Others as you start using them: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `VOYAGE_API_KEY`, `ALERT_WEBHOOK_URL`, `CRON_SECRET`.

### C3. Deploy

One-time GitHub setup (GitHub → the repository → Settings → Secrets and variables → Actions):

- Secret `AWS_DEPLOY_ROLE_ARN` = the `github_deploy_role_arn` output. Terraform created this role: GitHub signs in through OIDC, and the role can only push the app image and restart the app service. No AWS keys are stored in GitHub.
- Variables: the four in the `github_variables` output (`AWS_REGION`, `ECR_REPOSITORY_URL`, `ECS_CLUSTER`, `APP_URL`), plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local`.

Then: GitHub → Actions → **Deploy to AWS** → Run workflow (branch with the code you want live, environment `production`). It builds the image, pushes it, rolls out, waits until healthy and checks `/api/health`. The first run takes about 10 minutes.

### C4. After the first deploy

- Supabase → Authentication → URL configuration: set the site URL and add `https://<app-domain>/auth/callback` to the redirect URLs.
- Google / Slack / HubSpot / Microsoft apps: their redirect addresses now use your app domain (the setup cards show the exact address). For Google: Google Cloud console → Credentials → your OAuth client → add `https://<app-domain>/api/integrations/google/callback`.
- Delete the `baba-setup` access key (IAM → Users → baba-setup → Security credentials) once everything works; create a new one only when you need to change the infrastructure.
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
