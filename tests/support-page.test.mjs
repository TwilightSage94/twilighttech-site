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

test('support page opens as a simple Rover help center', () => {
  assert.match(page, /Need help\?[\s\S]*Ask Rover\./);
  assert.match(page, /id="rover-search-form"/);
  assert.match(page, /Where can I get guides\?/);
  assert.match(page, /I want to work with Twilight/);
  assert.match(page, /What can Rover help you find\?/);
  assert.match(page, /does not inspect your account, device, or customer systems/i);
  assert.doesNotMatch(page, /Two sides\.|One clean handoff\.|What makes Rover Rover/i);
  assert.doesNotMatch(page, /type="password"|Sign in to Rover|Create ticket now/i);
});

test('Rover has deterministic public routes and stops instead of guessing', () => {
  for (const route of ['support', 'guides', 'work', 'rover', 'services', 'community', 'general']) {
    assert.match(runtime, new RegExp(`${route}: \\{`));
  }
  assert.match(runtime, /I’m not confident enough to guess that route/);
  assert.match(runtime, /return 'general'/);
  assert.doesNotMatch(runtime, /fetch\s*\(/);
});

test('support page keeps an accessible semantic baseline', () => {
  assert.match(page, /<html lang="en">/);
  assert.match(page, /class="skip-link" href="#main-content"/);
  assert.match(page, /<main id="main-content">/);
  assert.match(page, /<nav aria-label="Help center">/);
  assert.match(page, /role="search"/);
  assert.match(page, /for="rover-search"/);
  assert.match(page, /id="rover-answer" tabindex="-1"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /forced-colors:active/);
  assert.doesNotMatch(styles, /outline\s*:\s*none/);
});

test('support page uses the Twilight signal system without inventing a Rover mascot', () => {
  assert.match(page, /ROVER \/\/ PUBLIC GUIDE ONLINE/);
  assert.match(styles, /--cyan:#00f0ff/);
  assert.match(styles, /radial-gradient\(circle at 8% 18%/);
  assert.match(styles, /\.rover-presence/);
  assert.doesNotMatch(page + styles, /soft-rover/);
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
  assert.ok((page.match(/data-open-jbot/g) || []).length >= 2);
  assert.match(page, /jbot-frontdesk-content\.js/);
  assert.match(page, /jbot-widget\.js/);
  assert.doesNotMatch(page + runtime, /mailto:|action=|fetch\s*\(/);
});
