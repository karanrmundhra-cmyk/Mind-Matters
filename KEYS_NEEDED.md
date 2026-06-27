# Keys & accounts I need from you

You don't need everything at once — they're listed in the order the build reaches them.
Create a **fresh "Mind Matters" project** in each service (do **not** reuse the old one).
When you have a value, paste it to me and I'll wire it in (or I can connect via your Chrome/Mac).

## 🟡 Needed soon — Step 1 (database) & Step 2 (AI)

| # | Service | What to create | What to send me |
|---|---------|----------------|-----------------|
| 1 | **Supabase** (free tier) | New project named `mind-matters` | `DATABASE_URL`, `DIRECT_URL` (Project → Settings → Database), `Project URL`, `anon` key, `service_role` key (Settings → API) |
| 2 | **Anthropic API** | An API key | `ANTHROPIC_API_KEY` (starts `sk-ant-…`) — used by the AI parse/draft layer. Set a low spend cap to be safe. |

> With #1 and #2 I can build and run the entire core loop (capture → AI parse → confirm → reminders).

## 🟢 Needed later — Step 4 / Step 7 (email + sign-in)

| # | Service | What to create | What to send me |
|---|---------|----------------|-----------------|
| 3 | **Resend** | API key + verified sender domain (or use their test domain to start) | `RESEND_API_KEY`, the `from` address |
| 4 | **Google Cloud OAuth** | OAuth 2.0 Client (Web) for "Sign in with Google" | `Client ID` + `Client secret` — I'll plug these into Supabase Auth. I'll give you the exact redirect URL to paste. |

## 🔵 Needed for Step 8 (payments) — sandbox first

| # | Service | What to create | What to send me |
|---|---------|----------------|-----------------|
| 5 | **Razorpay** (India) | **Test mode** keys | `Key ID`, `Key Secret`, and a `Webhook Secret` |
| 6 | **Stripe** (international) | **Test mode** keys | `Secret key` (`sk_test_…`), `Publishable key` (`pk_test_…`), `Webhook signing secret` |

## ⚪ Optional — Step 10 (analytics + error tracking)

| # | Service | What to send me |
|---|---------|-----------------|
| 7 | **PostHog** | Project API key + host |
| 8 | **Sentry** | DSN |

---

### How to hand them over safely
- Paste them in chat as you get them and I'll place them into `.env.local` (never committed).
- Or tell me to connect directly via your Chrome/Mac for a given service and I'll walk through creating the project with you.
- I can start **right now** on everything that needs no keys (the whole design system + UI + data model + state machine), and slot keys in as they arrive.
