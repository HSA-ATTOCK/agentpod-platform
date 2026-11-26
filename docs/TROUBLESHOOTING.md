# Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| "Baba isn't set up yet" | Missing `ANTHROPIC_API_KEY`, `BABA_AGENT_ID` or `BABA_ENVIRONMENT_ID` | Add the key to `.env.local`, run `npm run baba:setup`, restart. |
| Baba doesn't know about a new tool or agent | Agents not republished | `npm run baba:setup`, then restart. Older chats get the new tools automatically. |
| "Baba is switched off on this deployment" | Production without `BABA_ALLOW_PUBLIC=true` | Set it once accounts need approval (they do by default). |
| A user only sees "waiting for approval" | Account is pending | Admin → Registrations → Approve. |
| No /admin link | Not a platform admin | `npm run admin:bootstrap -- your@email`, then sign out and in. |
| Admin pages are 404 | `SUPABASE_SECRET_KEY` missing on the server, or not an admin | Add the key; check Admin rights. |
| "Connected tools aren't set up on this server" | `SUPABASE_SECRET_KEY` missing | Add it to the server settings. |
| Emails don't arrive | Gmail settings missing or wrong | `npm run email:test -- you@example.com`; use a Google *App password*. |
| Sign-in or logout goes to localhost | Wrong public address | Set `NEXT_PUBLIC_SITE_URL`; in Supabase add `<site>/auth/callback` to redirect URLs. |
| Google / Slack / HubSpot / Microsoft sign-in fails with "redirect mismatch" | The app's redirect address doesn't match | Copy the exact address from the setup card into the provider's app settings. |
| A connection shows "reconnect" | Token revoked or expired | Integrations → Connect again (or ask Baba). |
| Workflow didn't run | App wasn't running at that time, workflow off, or limit reached | Check Activity for "Missed" or limit messages; keep the app running or set `BABA_SCHEDULER=off` with an external cron calling `/api/cron/workflows`. |
| "Your plan allows N workflows/connections" | Plan quota | Remove one or change plan (Admin → Workspaces, or Usage & billing). |
| Task stopped: specialist "isn't available on this workspace's plan" | Admin restricted agents | Admin → Workspaces → Plan & limits. |
| Database connection fails | Host not public, firewall, wrong SSL setting | Allow the server's IP, use the public host name, try with/without SSL. Private addresses are refused by design. |
| Website "Publish live" button missing | AWS settings not configured | See DEPLOYMENT_GUIDE part C. Preview links work without it. |
| Upgrade buttons missing | Stripe not configured, or plan has no Price ID | Add Stripe keys; put Price IDs in Admin → Plans. |
| Knowledge search misses obvious matches | Keyword search only | Add `OPENAI_API_KEY` or `VOYAGE_API_KEY` for search by meaning. |
| Long document cut off | Older chat before part-reading | Ask again; Baba reads Google Docs in parts until the end. |

Logs: server errors are one JSON line each (`"level":"error"`). Admin → System health shows dependencies and recent failed tasks.
