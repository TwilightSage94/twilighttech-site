# J-Bot Google lead receiver

This Apps Script turns a verified J-Bot submission into two explicit outcomes:

1. a permanent row in the **Twilight Tech - J-Bot Leads** Google Sheet;
2. a Gmail notification sent from the Google account that owns the script.

## Deploy

1. Open the `Twilight Tech - J-Bot Leads` Sheet.
2. Choose **Extensions > Apps Script**.
3. Replace the starter code with `jbot-leads.gs`.
4. In **Project Settings > Script Properties**, add `SHEET_ID` and `NOTIFICATION_EMAIL` with the customer-owned Sheet and notification destination. There is no Twilight default. (`configureJBot(sheetId, notificationEmail)` is also available when configuration is invoked programmatically.)
5. Run `setupJBot` once and approve the requested Google permissions.
6. Copy `JBOT_GOOGLE_SECRET` from the execution log.
7. Choose **Deploy > New deployment > Web app**.
8. Set **Execute as** to **Me** and **Who has access** to **Anyone**.
9. Deploy and copy the `/exec` URL.
10. Add the URL to Cloudflare Pages as the encrypted `JBOT_GOOGLE_ENDPOINT` secret.
11. Add the generated secret as the encrypted `JBOT_GOOGLE_SECRET` secret.

The web app is public only at the network edge. Every POST must carry the shared secret, which remains server-side in Cloudflare, and J-Bot still requires successful Turnstile verification before Cloudflare forwards a lead.

Cloudflare forwards a stable request ID. Apps Script stores a receipt before attempting Gmail, so a timeout or retry within the 30-day receipt window returns the existing lead and only retries a failed notification instead of appending a duplicate row. Old receipts are pruned to keep Script Properties bounded.
