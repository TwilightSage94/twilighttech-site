# J-Bot Google lead receiver

This Apps Script turns a verified J-Bot submission into two explicit outcomes:

1. a permanent row in the **Twilight Tech - J-Bot Leads** Google Sheet;
2. a Gmail notification sent from the Google account that owns the script.

## Deploy

1. Open the `Twilight Tech - J-Bot Leads` Sheet.
2. Choose **Extensions > Apps Script**.
3. Replace the starter code with `jbot-leads.gs`.
4. Run `setupJBot` once and approve the requested Google permissions.
5. Copy `JBOT_GOOGLE_SECRET` from the execution log.
6. Choose **Deploy > New deployment > Web app**.
7. Set **Execute as** to **Me** and **Who has access** to **Anyone**.
8. Deploy and copy the `/exec` URL.
9. Add the URL to Cloudflare Pages as the encrypted `JBOT_GOOGLE_ENDPOINT` secret.
10. Add the generated secret as the encrypted `JBOT_GOOGLE_SECRET` secret.

The web app is public only at the network edge. Every POST must carry the shared secret, which remains server-side in Cloudflare, and J-Bot still requires successful Turnstile verification before Cloudflare forwards a lead.
