# Front Desk release handoff

The reusable customer-ownership checklist lives with the Front Desk product source. For this Twilight Technology deployment, release only after these deployment-specific checks are approved:

- publish the reviewed `/assets/frontdesk-public-answers.json` revision;
- configure the Twilight-owned Sheet ID and notification mailbox explicitly in Apps Script;
- deploy the cache-busted site assets and Cloudflare Pages function first while the current receiver remains compatible, then verify new submissions carry a stable request ID;
- deploy the updated Apps Script receiver after the browser/runtime and function are live; legacy submissions remain accepted but cannot be deduplicated;
- run one synthetic successful inquiry and remove or label its test record;
- simulate a saved lead with failed Gmail notification, then retry the same request ID and confirm a single row;
- verify production origin and Turnstile hostname rejection with non-production test values;
- walk the widget by keyboard and on a narrow touch viewport;
- verify the runtime-load and answer-registry-load fallbacks do not claim an answer or delivery;
- record the deployed Git revisions and rollback point.

Do not publish, change credentials, create triggers, or send live inquiries as part of a source-only review.
