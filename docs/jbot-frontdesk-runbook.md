# J-Bot Front Desk production runbook

The public Front Desk is a deterministic site workflow. It does not call a model, expose a provider key, or let generated text control routing, validation, pricing, security, or lead delivery.

## One content source

Public lanes, page context, prompts, prices, resource links, stage labels, support email, and visitor-facing shell copy live in:

`assets/jbot-frontdesk-content.js`

The browser shell and conversation engine consume that registry. The Cloudflare lead proxy keeps a separate lane allowlist because server-side validation must not trust browser configuration.

## Cloudflare production configuration

Required variables and secrets:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_ALLOWED_HOSTNAMES=twilighttech.io,www.twilighttech.io,support.twilighttech.io`
- `JBOT_GOOGLE_ENDPOINT`
- `JBOT_GOOGLE_SECRET`
- `JBOT_ALLOWED_ORIGINS=https://twilighttech.io,https://www.twilighttech.io,https://support.twilighttech.io`
- `JBOT_DELIVERY_TIMEOUT_MS=8000` (optional; bounded to 1-15 seconds)

Recommended rate-limit protection, in order:

1. A Cloudflare perimeter rate-limit rule for `POST /api/jbot-leads`.
2. A `JBOT_RATE_LIMITER` Rate Limiting binding when the Pages runtime supports it.
3. A Pages KV binding named `JBOT_RATE_LIMIT_KV`.
4. The built-in isolate-local fallback remains active when neither binding exists.

Rate-limit keys are SHA-256 hashes of the visitor IP and reply email. Raw identifiers are not written to the rate-limit binding.

`_routes.json` limits Pages Function invocation to `/api/*`; static pages and assets stay outside the function path.

## Health and receipts

`GET /api/jbot-health` returns only:

- whether Turnstile is configured,
- whether Google delivery is configured,
- whether rate limiting is using a binding, KV, or isolate fallback.

Every lead attempt receives an `X-JBot-Request-ID`. Successful and failed delivery responses include the same ID, and server logs record only the ID plus delivery booleans. They do not log the visitor's name, email, or note.

## Privacy-safe analytics

Plausible receives funnel events with page, lane, stage, and delivery booleans only:

- `J-Bot Opened`
- `J-Bot Closed`
- `J-Bot Lane Selected`
- `J-Bot Resource Clicked`
- `J-Bot Note Started`
- `J-Bot Review Reached`
- `J-Bot Security Verified` or `J-Bot Security Failed`
- `J-Bot Note Attempted`
- `J-Bot Note Filed` or `J-Bot Note Failed`

Never add the visitor's name, email, free text, transcript, or Turnstile token to analytics properties.

## Production smoke test

1. Confirm `/api/jbot-config` returns HTTP 200 without exposing the Turnstile secret.
2. Confirm `/api/jbot-health` returns `status: ready`.
3. Open the Front Desk on home, Private AI, Services, Guides, About, and Website Front Desk pages.
4. Confirm each page puts its relevant lane first.
5. Select every lane and confirm each resource link reaches its intended public destination.
6. Type a note while on a resource card and confirm the flow advances to name capture.
7. Complete one clearly labeled production smoke-test note after human Turnstile verification.
8. Confirm the note appears in Google Leads and the Gmail alert arrives.
9. Match the eight-character visitor receipt to the full request ID in Cloudflare logs if delivery fails.

## Failure response

- Health says `misconfigured`: restore the missing Cloudflare variable or secret, then redeploy.
- Health says `isolate-fallback`: restore the rate-limit binding or verify the perimeter rule.
- Turnstile failures: verify hostname and action `jbot_lead`, then rotate the secret if exposure is suspected.
- Google delivery failures: use the request ID to inspect logs; never paste the visitor note into monitoring tools.
- Browser shows old copy: bump the shared asset version and conversation storage namespace together.
