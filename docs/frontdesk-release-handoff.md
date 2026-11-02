# Front Desk release handoff

The reusable customer-ownership checklist lives with the Front Desk product source. For this Twilight Technology deployment, release only after these deployment-specific checks are approved:

- publish the reviewed `/assets/frontdesk-public-answers.json` revision;
- configure the Twilight-owned Sheet ID and notification mailbox explicitly in Apps Script;
- deploy the updated Apps Script receiver and Cloudflare Pages functions;
- run one synthetic successful inquiry and remove or label its test record;
- simulate a saved lead with failed Gmail notification, then retry the same request ID and confirm a single row;
- verify production origin and Turnstile hostname rejection with non-production test values;
- walk the widget by keyboard and on a narrow touch viewport;
- verify the runtime-load and answer-registry-load fallbacks do not claim an answer or delivery;
- record the deployed Git revisions and rollback point.

Do not publish, change credentials, create triggers, or send live inquiries as part of a source-only review.
