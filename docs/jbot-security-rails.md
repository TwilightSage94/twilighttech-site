# J-Bot Front Desk security rails

J-Bot v1 is intentionally a guided intake widget, not a free-form LLM agent.

## Current client-side rails

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

The browser helper now posts to `/api/jbot-leads` instead of directly exposing the lead endpoint and Formspree endpoint.

### Expected production environment variables

- `JBOT_LEADS_ENDPOINT`
  - Private lead API endpoint.
  - Falls back to the current testmachine endpoint if unset.
- `JBOT_EMAIL_ENDPOINT`
  - Email delivery/Formspree endpoint.
  - Falls back to the current Formspree form if unset.
- `JBOT_ALLOWED_ORIGINS`
  - Comma-separated origin allowlist.
  - Example: `https://twilighttech.io,https://www.twilighttech.io`
- `TURNSTILE_SITE_KEY`
  - Public Turnstile sitekey returned to the widget through `/api/jbot-config`.
- `TURNSTILE_SECRET_KEY`
  - Private Turnstile secret used only by the Cloudflare function for Siteverify.

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

## Remaining production note

Do not rely only on in-memory rate limits in the function isolate. Add host/platform rate limits before opening this across the full site.
