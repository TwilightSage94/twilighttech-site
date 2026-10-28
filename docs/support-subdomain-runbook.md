# Support subdomain release

`support.twilighttech.io` is a second public entrance to the existing Twilight Technology Pages project. It does not create a second submission backend or a separate customer-data store.

## Source route

- `/support/index.html` owns the support experience.
- `/support/support.css` and `/support/support.js` own the page-specific presentation and sample interaction.
- `functions/index.js` serves `/support/index.html` only when the request host is `support.twilighttech.io`.
- Requests to the ordinary `twilighttech.io` root continue through the existing homepage.

## Cloudflare release steps

1. Deploy the repository revision to the current Twilight Technology Pages project.
2. Add `support.twilighttech.io` as a custom domain on that same project.
3. If environment overrides are set, include the support host in both lists:
   - `JBOT_ALLOWED_ORIGINS=https://twilighttech.io,https://www.twilighttech.io,https://support.twilighttech.io`
   - `TURNSTILE_ALLOWED_HOSTNAMES=twilighttech.io,www.twilighttech.io,support.twilighttech.io`
4. Confirm the Turnstile widget configuration also permits `support.twilighttech.io`.
5. Verify the deployed root returns the support-page title and that `https://twilighttech.io/` still returns the ordinary homepage.
6. Open the Front Desk from the support host, complete the verification step, and send a synthetic high-level note. Verify a provider receipt before claiming the public submission path works.

## Claim boundary

The public page is a safe product preview. It does not authenticate a customer, inspect a device, query a live knowledge base, or create a support ticket. The existing bounded Front Desk is the only public submission path.
