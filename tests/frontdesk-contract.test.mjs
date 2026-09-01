import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionPages = [
  'index.html',
  'about/index.html',
  'ai/index.html',
  'ai/operations/index.html',
  'ai/yours/index.html',
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
const primaryNavPages = [
  ...productionPages.filter((path) => path !== 'labs/index.html'),
  'labs/workshop/index.html',
];

const widget = readFileSync(new URL('../assets/jbot-widget.js', import.meta.url), 'utf8');
const desk = readFileSync(new URL('../assets/jbot-frontdesk.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('../assets/jbot-frontdesk-content.js', import.meta.url), 'utf8');
const leadProxy = readFileSync(new URL('../functions/api/jbot-leads.js', import.meta.url), 'utf8');
const solutionsIntake = readFileSync(new URL('../assets/solutions-intake.js', import.meta.url), 'utf8');
const healthFunction = readFileSync(new URL('../functions/api/jbot-health.js', import.meta.url), 'utf8');
const homePage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const siteStyles = readFileSync(new URL('../assets/site.css', import.meta.url), 'utf8');
const functionRoutes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));
const runtime = `${contentSource}\n${widget}\n${desk}\n${leadProxy}`;
const contentSandbox = { window: {} };
runInNewContext(contentSource, contentSandbox);
const content = contentSandbox.window.TwilightFrontDeskContent;

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

test('the edge proxy is bounded, origin-aware, and observable without storing chat analytics', () => {
  assert.match(leadProxy, /MAX_BODY_BYTES/);
  assert.match(leadProxy, /originAllowed/);
  assert.match(leadProxy, /turnstileResultAllowed/);
  assert.match(leadProxy, /JBOT_RATE_LIMITER/);
  assert.match(leadProxy, /JBOT_RATE_LIMIT_KV/);
  assert.match(leadProxy, /X-JBot-Request-ID/);
  assert.match(leadProxy, /AbortController/);
  assert.ok(
    leadProxy.indexOf('await checkRateLimit') < leadProxy.indexOf('await verifyTurnstile'),
    'rate limiting should protect the external security verification call',
  );
  assert.match(healthFunction, /google_delivery/);
  assert.match(healthFunction, /isolate-fallback/);
  assert.deepEqual(functionRoutes.include, ['/api/*', '/labs', '/labs/']);

  const analyticsCalls = desk.split(/\r?\n/).filter((line) => /trackEvent\(/.test(line)).join('\n');
  assert.doesNotMatch(analyticsCalls, /uiState\.(name|email|need)|input\.value/);
});

test('every public visitor lane has a deterministic route', () => {
  const laneSlugs = [
    'private-ai',
    'site-chat',
    'system-care',
    'guides',
    'breakroom',
    'aptsu',
  ];
  assert.deepEqual(Array.from(content.lanes.filter((lane) => lane.icon), (lane) => lane.slug), laneSlugs);
  laneSlugs.forEach((lane) => assert.ok(content.resources[lane], `missing resource route: ${lane}`));
  assert.match(desk, /CONTENT\.resources/);
  assert.doesNotMatch(desk, /\$999|discord\.gg|calendar\.app\.google/);
});

test('the legacy personal AI lane remains bounded and hidden', () => {
  const lane = content.lanes.find((item) => item.slug === 'personal-ai');
  assert.equal(lane.leadLabel, 'Personal AI Assistant');
  assert.equal(Boolean(lane.icon), false, 'the campaign lane should not alter the public Front Desk menu');
  assert.match(leadProxy, /'personal-ai': 'Personal AI Assistant'/);
});

test('the Solutions campaign has a hidden bounded lead lane', () => {
  const lane = content.lanes.find((item) => item.slug === 'solutions');
  assert.equal(lane.leadLabel, 'Twilight Tech Solutions');
  assert.equal(Boolean(lane.icon), false, 'the campaign lane should not alter the public Front Desk menu');
  assert.match(leadProxy, /'solutions': 'Twilight Tech Solutions'/);
  const page = readFileSync(resolve(root, 'ai/yours/index.html'), 'utf8');
  assert.match(page, /What operation is your team still holding together by hand\?/);
  assert.match(solutionsIntake, /lane: 'solutions'/);
  assert.match(page, /https:\/\/twilighttech\.io\/ai\/yours\//);
});

test('the primary navigation stays condensed to five public doors', () => {
  const labels = ['Managed IT', 'AI Solutions', 'Labs', 'Guides', 'Contact'];

  primaryNavPages.forEach((path) => {
    const html = readFileSync(resolve(root, path), 'utf8');
    const nav = html.match(/<div class="nav-links">([\s\S]*?)<\/div>/)?.[1] || '';
    let priorIndex = -1;

    labels.forEach((label) => {
      const labelIndex = nav.indexOf(label);
      assert.ok(labelIndex > priorIndex, `${label} is missing or out of order: ${path}`);
      priorIndex = labelIndex;
    });

    assert.match(nav, /href="\/services\/"[^>]*>Managed IT<\/a>/);

    ['/managed-it/', '/ai/', '/site-chat/', '/about/'].forEach((legacyTopLevelRoute) => {
      assert.equal(
        nav.includes(`href="${legacyTopLevelRoute}"`),
        false,
        `legacy top-level route leaked into primary navigation: ${path}`,
      );
    });
  });
});

test('the homepage turns Enter, Sustain, and Further into real gateways', () => {
  const page = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(page, /class="mission-line enter"><a href="#enter"/);
  assert.match(page, /class="mission-line sustain"><a href="#sustain"/);
  assert.match(page, /class="mission-line further"><a href="#further"/);
  assert.match(page, /class="pathway enter" id="enter"/);
  assert.match(page, /class="path-link primary" href="\/guides\/">Enter through Guides/);
  assert.match(page, /class="path-link primary" href="\/services\/">Enter Managed IT/);
  assert.match(page, /class="path-link primary" href="\/ai\/yours\/">Enter AI Solutions/);
});

test('AI Solutions opens with the offer name and a stable campaign intake link', () => {
  const page = readFileSync(resolve(root, 'ai/yours/index.html'), 'utf8');
  assert.match(page, /<div class="sol-kicker">Twilight Technology · Atlanta<\/div>/);
  assert.match(page, /<h1 class="sol-title"><span class="glow">AI Solutions<\/span><\/h1>/);
  assert.doesNotMatch(page, /six tabs and one person's head/i);
  assert.match(page, /<section[^>]+id="start"/);
  assert.match(page, /href="#start"/);
});

test('the homepage headline and navigation stay inside narrow phone viewports', () => {
  assert.match(homePage, /font-size:clamp\(1\.15rem,6\.3vw,1\.75rem\)/);
  assert.match(homePage, /\.mission-line\{width:100%;white-space:nowrap\}/);
  assert.match(homePage, /site\.css\?v=20260901-mobile-home/);
  assert.match(siteStyles, /\.nav-inner\{padding:0 1rem\}/);
  assert.match(siteStyles, /\.nav-logo\{font-size:\.86rem;letter-spacing:1\.8px\}/);
});

test('managed plans and one-time fixes share one service desk', () => {
  const page = readFileSync(resolve(root, 'services/index.html'), 'utf8');
  const legacyPage = readFileSync(resolve(root, 'managed-it/index.html'), 'utf8');

  assert.match(page, /id="managed-plans"/);
  assert.match(page, /Choose Your <span class="ac">Protection Level<\/span>/);
  assert.match(page, /id="one-time-services"/);
  assert.match(page, /Pay for the fix, <span class="ac">not a subscription<\/span>/);
  assert.match(page, /id="svc-menu"/);
  assert.match(legacyPage, /url=\/services\/#managed-plans/);
  assert.match(legacyPage, /location\.replace\('\/services\/#managed-plans'\)/);
});

test('public pages scope commercial work without publishing price points', () => {
  productionPages.forEach((path) => {
    const html = readFileSync(resolve(root, path), 'utf8');
    assert.doesNotMatch(html, /\$\s*\d/, `public price point found: ${path}`);
    assert.doesNotMatch(html, /buy\.stripe\.com/, `direct checkout found: ${path}`);
    assert.doesNotMatch(html, /"price(?:Currency|Specification)?"\s*:/, `price metadata found: ${path}`);
  });

  assert.doesNotMatch(contentSource, /\$\s*\d/);
});

test('the widget exposes truthful deterministic stages', () => {
  assert.equal(content.shell.subtitle, 'Twilight Tech front desk');
  assert.match(widget, /twilight:jbot-state/);
  assert.match(desk, /twilight:jbot-state/);
  assert.match(desk, /tt_jbot_chat_frontdesk_v3/);
  assert.match(desk, /tt_jbot_state_frontdesk_v3/);
  assert.match(desk, /Built from the answers above - review before sending/);
  assert.doesNotMatch(runtime, /no open-ended AI|Code-owned path|no model response generated|Approved site copy/);
});

test('resource browsing can always transition into a desk note', () => {
  assert.match(desk, /uiState\.stage === 'resource'/);
  assert.match(desk, /J-Bot Note Started/);
  assert.match(desk, /J-Bot Review Reached/);
});

test('the compact widget keeps keyboard focus and avoids surprise touch keyboards', () => {
  assert.match(widget, /trapCompactFocus/);
  assert.match(widget, /syncCompactState/);
  assert.match(widget, /window\.addEventListener\('resize'/);
  assert.match(widget, /pointer: coarse/);
  assert.match(widget, /aria-describedby="jbot-consent"/);
  assert.match(widget, /aria-label="Open Twilight Tech front desk"/);
  assert.match(widget, /enterkeyhint="send"/);
});

test('the widget fails into a usable direct-contact state', () => {
  assert.match(widget, /script\.onerror/);
  assert.match(widget, /J-Bot Runtime Failed/);
  assert.match(widget, /mailto:' \+ CONTENT\.supportEmail/);
  assert.match(widget, /stage: 'unavailable'/);
  assert.equal(content.supportEmail, 'james@twilighttech.io');
  assert.match(desk, /turnstileState\.sitekeyPromise = null/);
  assert.match(desk, /turnstileState\.loadPromise = null/);
});

test('all production pages request the current widget version', () => {
  productionPages.forEach((path) => {
    const html = readFileSync(resolve(root, path), 'utf8');
    assert.match(html, /jbot-frontdesk-content\.js\?v=20260811-frontdesk-v3a/);
    assert.match(html, /jbot-widget\.js\?v=20260811-frontdesk-v3a/);
    assert.ok(
      html.indexOf('jbot-frontdesk-content.js') < html.indexOf('jbot-widget.js'),
      `content must load before widget: ${path}`,
    );
  });
});
