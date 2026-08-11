# J-Bot Front Desk security rails

J-Bot Front Desk is intentionally a guided intake widget, not a free-form LLM agent.

## Deterministic runtime contract

- The public widget has no model client, model endpoint, provider key, prompt, or token budget.
- Page context selects from a fixed route table; it never asks a model where to send a visitor.
- Visitor state advances through explicit stages: route, contact, need, timing, review, security, and completion.
- Service explanations are approved site copy, labeled as such in the interface.
- The final handoff contains only the reviewed intake fields, not a generated summary or hidden transcript.
- Loading, verification, success, and failure labels are driven by real application state.
- A future model may only be added after a deterministic route completes, behind its own explicit consent, fallback, and observability boundary. It must not own routing, validation, permissions, pricing, or submission.

## Client-side rails

- Allowed route list only:
  - Private AI
  - Website Chat / Intake
  - System Care
  - Guides / Freebies
  - BreakRoom
  - A Place To Show Up
  - General
- Email format validation before submit.
- Honeypot field support via `hp`.
- Field length caps before submit.
- Angle brackets/control characters stripped from submitted text.
- Sensitive-term warning for passwords, API keys, secrets, SSNs, credit cards, custody, medical records, and client-file wording.
- Local per-browser submit cooldown.
- Cloudflare Turnstile token required before the browser can submit.
- Lead API and email alert are called separately.

## Server-side proxy added

`functions/api/jbot-leads.js` is the intended public front door:

`twilighttech.io` widget -> `/api/jbot-leads` -> private lead service + email alert

The browser helper posts to `/api/jbot-leads` instead of exposing the Google delivery endpoint or shared secret.

### Expected production environment variables

- `JBOT_GOOGLE_ENDPOINT`
  - Private Google Apps Script delivery endpoint.
- `JBOT_GOOGLE_SECRET`
  - Shared delivery secret; never returned to the browser.
- `JBOT_ALLOWED_ORIGINS`
  - Comma-separated origin allowlist.
  - Example: `https://twilighttech.io,https://www.twilighttech.io`
- `TURNSTILE_SITE_KEY`
  - Public Turnstile sitekey returned to the widget through `/api/jbot-config`.
- `TURNSTILE_SECRET_KEY`
  - Private Turnstile secret used only by the Cloudflare function for Siteverify.
- `TURNSTILE_ALLOWED_HOSTNAMES`
  - Comma-separated Turnstile hostname allowlist.
- `JBOT_RATE_LIMIT_KV`
  - Optional Pages KV binding for hashed cross-isolate rate limiting.

## Must also be enforced server-side/private service

The public proxy now mirrors the browser-side validation. The private Lead API should still treat every proxied request as hostile.

- Re-validate email format.
- Re-validate lane against the same allowlist.
- Enforce max field lengths.
- Drop or quarantine honeypot submissions.
- Escape all submitted values in admin screens and outbound emails.
- Rate limit by IP, email, and path. The proxy has a lightweight in-memory limiter, but production should use durable platform rate limits too.
- Restrict CORS to `https://twilighttech.io` and any explicit local dev origins only.
- Log delivery failures without exposing stack traces to visitors.
- Prefer storing a short summary over full chat transcripts.
- Keep Turnstile hostname restrictions limited to the production Twilight Tech domains.
- Monitor Turnstile validation failures and rotate the secret if it is ever exposed.

See `docs/jbot-frontdesk-runbook.md` for the complete production health, analytics, deployment, and incident checklist.

## Remaining production note

Do not rely only on in-memory rate limits in the function isolate. Add host/platform rate limits before opening this across the full site.
