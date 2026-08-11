import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionPages = [
  'index.html',
  'about/index.html',
  'ai/index.html',
  'ai/operations/index.html',
  'cheat-sheet/index.html',
  'guides/index.html',
  'homelab-starter/index.html',
  'labs/index.html',
  'managed-it/index.html',
  'roadmap/index.html',
  'services/index.html',
  'site-chat/index.html',
  'strategy/index.html',
];

const widget = readFileSync(new URL('../assets/jbot-widget.js', import.meta.url), 'utf8');
const desk = readFileSync(new URL('../assets/jbot-frontdesk.js', import.meta.url), 'utf8');
const leadProxy = readFileSync(new URL('../functions/api/jbot-leads.js', import.meta.url), 'utf8');
const runtime = `${widget}\n${desk}\n${leadProxy}`;

test('the public Front Desk has no model or chat-provider dependency', () => {
  const forbidden = [
    '/demobot/chat',
    'api.openai.com',
    'api.anthropic.com',
    'integrate.api.nvidia.com',
    'NIM_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
  ];

  forbidden.forEach((value) => {
    assert.equal(runtime.includes(value), false, `unexpected model dependency: ${value}`);
  });
});

test('the only visitor submission path is the bounded lead proxy', () => {
  assert.match(desk, /JBOT_PROXY_ENDPOINT\s*=\s*['"]\/api\/jbot-leads['"]/);
  assert.match(desk, /fetch\(['"]\/api\/jbot-config['"]/);
  assert.doesNotMatch(desk, /fetch\(['"][^'"]*\/chat/);
  assert.match(leadProxy, /verifyTurnstile/);
  assert.match(leadProxy, /validateLead/);
  assert.match(leadProxy, /checkRateLimit/);
});

test('every public visitor lane has a deterministic route', () => {
  [
    'private-ai',
    'site-chat',
    'system-care',
    'guides',
    'breakroom',
    'aptsu',
  ].forEach((lane) => {
    assert.match(desk, new RegExp(`['"]${lane}['"]\\s*:\\s*\\{`));
  });
  assert.match(desk, /RESOURCE_ROUTES/);
});

test('the widget exposes truthful deterministic stages', () => {
  assert.match(widget, /Twilight Tech front desk/);
  assert.match(widget, /twilight:jbot-state/);
  assert.match(desk, /twilight:jbot-state/);
  assert.match(desk, /tt_jbot_chat_frontdesk_v2/);
  assert.match(desk, /tt_jbot_state_frontdesk_v2/);
  assert.match(desk, /Built from the answers above - review before sending/);
  assert.doesNotMatch(runtime, /no open-ended AI|Code-owned path|no model response generated|Approved site copy/);
});

test('all production pages request the current widget version', () => {
  productionPages.forEach((path) => {
    const html = readFileSync(resolve(root, path), 'utf8');
    assert.match(html, /jbot-widget\.js\?v=20260810-frontdesk-v2-live/);
  });
});
