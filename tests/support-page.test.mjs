import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../support/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../support/support.css', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../support/support.js', import.meta.url), 'utf8');
const widget = readFileSync(new URL('../assets/jbot-widget.js', import.meta.url), 'utf8');
const content = readFileSync(new URL('../assets/jbot-frontdesk-content.js', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../functions/api/jbot-leads.js', import.meta.url), 'utf8');
const rootRoute = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
const routes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));

test('support page opens as a working desk instead of a product landing page', () => {
  assert.match(page, /What do you need help with\?/);
  assert.match(page, /id="get-help"/);
  assert.match(page, /id="handoff"/);
  assert.match(page, /id="what-happens"/);
  assert.match(page, /Guided preview/);
  assert.match(page, /does not inspect your account, device, or customer systems/i);
  assert.match(page, /no ticket created/i);
  assert.doesNotMatch(page, /Two sides\.|One clean handoff\.|What makes Rover Rover/i);
  assert.doesNotMatch(page, /type="password"|Sign in to Rover|Create ticket now/i);
});

test('support preview preserves Rover boundaries and source visibility', () => {
  assert.match(page, /Reviewed support guidance/);
  assert.match(page, /No account, permission, device, or ticket change was made/);
  assert.match(page, /What the person said/);
  assert.match(page, /What the systems support/);
  assert.match(page, /What Rover suggests checking/);
  assert.match(runtime, /KB-JL-LOGIN-001/);
  assert.match(runtime, /KB-JL-NETWORK-001/);
  assert.match(runtime, /KB-JL-ACCESS-001/);
  assert.match(runtime, /secretPattern/);
  assert.doesNotMatch(runtime, /fetch\s*\(/);
});

test('support page keeps an accessible semantic baseline', () => {
  assert.match(page, /<html lang="en">/);
  assert.match(page, /class="skip-link" href="#main-content"/);
  assert.match(page, /<main id="main-content" class="main-workspace">/);
  assert.match(page, /<nav aria-label="Support page">/);
  assert.match(page, /<label for="support-question">/);
  assert.match(page, /aria-describedby="question-help question-error"/);
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /forced-colors:active/);
  assert.doesNotMatch(styles, /outline\s*:\s*none/);
});

test('support host opens in Rover context and remains inside the bounded Front Desk proxy', () => {
  assert.match(content, /hosts: \['support\.twilighttech\.io'\]/);
  assert.match(widget, /context\.hosts/);
  assert.match(proxy, /https:\/\/support\.twilighttech\.io/);
  assert.match(proxy, /'support\.twilighttech\.io'/);
  assert.match(rootRoute, /SUPPORT_HOST = 'support\.twilighttech\.io'/);
  assert.match(rootRoute, /context\.env\.ASSETS\.fetch/);
  assert.deepEqual(routes.include, ['/', '/api/*', '/labs', '/labs/']);
});

test('support page uses the real Front Desk as its only public submission route', () => {
  assert.ok((page.match(/data-open-jbot/g) || []).length >= 3);
  assert.match(page, /jbot-frontdesk-content\.js/);
  assert.match(page, /jbot-widget\.js/);
  assert.doesNotMatch(page + runtime, /mailto:|action=|fetch\s*\(/);
});
