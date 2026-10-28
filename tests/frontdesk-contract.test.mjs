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
  'enter/index.html',
  'further/index.html',
  'guides/index.html',
  'homelab-starter/index.html',
  'labs/index.html',
  'managed-it/index.html',
  'roadmap/index.html',
  'rover/index.html',
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
const siteRuntime = readFileSync(new URL('../assets/site.js', import.meta.url), 'utf8');
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
  assert.deepEqual(functionRoutes.include, ['/', '/api/*', '/labs', '/labs/']);

  const analyticsCalls = desk.split(/\r?\n/).filter((line) => /trackEvent\(/.test(line)).join('\n');
  assert.doesNotMatch(analyticsCalls, /uiState\.(name|email|need)|input\.value/);
});

test('every public visitor lane has a deterministic route', () => {
  const laneSlugs = [
    'rover',
    'private-ai',
    'site-chat',
    'system-care',
    'guides',
    'breakroom',
    'aptsu',
  ];
  assert.deepEqual(Array.from(content.lanes.filter((lane) => lane.icon), (lane) => lane.slug), laneSlugs);
  laneSlugs.forEach((lane) => {
    assert.ok(content.resources[lane], `missing resource route: ${lane}`);
    assert.match(leadProxy, new RegExp(`'${lane}'\\s*:`), `lead proxy does not accept public lane: ${lane}`);
  });
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
  const labels = ['Enter', 'Sustain', 'Further', 'Labs', 'Contact'];

  primaryNavPages.forEach((path) => {
    const html = readFileSync(resolve(root, path), 'utf8');
    const nav = html.match(/<div class="nav-links">([\s\S]*?)<\/div>/)?.[1] || '';
    let priorIndex = -1;

    labels.forEach((label) => {
      const labelIndex = nav.indexOf(label);
      assert.ok(labelIndex > priorIndex, `${label} is missing or out of order: ${path}`);
      priorIndex = labelIndex;
    });

    assert.match(nav, /href="\/enter\/"[^>]*>Enter<\/a>/);
    assert.match(nav, /href="\/services\/"[^>]*>Sustain<\/a>/);
    assert.match(nav, /href="\/further\/"[^>]*>Further<\/a>/);
    assert.match(nav, /href="\/labs\/"[^>]*>Labs<\/a>/);

    ['/managed-it/', '/ai/', '/site-chat/', '/about/'].forEach((legacyTopLevelRoute) => {
      assert.equal(
        nav.includes(`href="${legacyTopLevelRoute}"`),
        false,
        `legacy top-level route leaked into primary navigation: ${path}`,
      );
    });
  });
});

test('supporting pages identify their active mission stage', () => {
  const stagePages = {
    Enter: [
      'enter/index.html',
      'guides/index.html',
      'roadmap/index.html',
      'homelab-starter/index.html',
      'cheat-sheet/index.html',
      'strategy/index.html',
    ],
    Sustain: ['services/index.html', 'managed-it/index.html'],
    Further: [
      'further/index.html',
      'ai/index.html',
      'ai/operations/index.html',
      'ai/yours/index.html',
      'site-chat/index.html',
    ],
    Labs: ['labs/workshop/index.html'],
  };

  Object.entries(stagePages).forEach(([label, paths]) => {
    paths.forEach((path) => {
      const html = readFileSync(resolve(root, path), 'utf8');
      const nav = html.match(/<div class="nav-links">([\s\S]*?)<\/div>/)?.[1] || '';
      assert.match(
        nav,
        new RegExp(`<a[^>]*class="active"[^>]*aria-current="page"[^>]*>${label}<\\/a>`),
        `${path} should identify ${label} as its active mission stage`,
      );
    });
  });
});

test('the homepage turns Enter, Sustain, and Further into real gateways', () => {
  const page = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(page, /class="mission-line enter"><a href="\/enter\/"/);
  assert.match(page, /class="mission-line sustain"><a href="\/services\/"/);
  assert.match(page, /class="mission-line further"><a href="\/further\/"/);
  assert.match(page, /class="pathway enter" id="enter"/);
  assert.match(page, /class="path-link primary" href="\/enter\/">Explore Enter Technology/);
  assert.match(page, /class="path-link primary" href="\/services\/">Enter Managed IT/);
  assert.match(page, /class="path-link primary" href="\/further\/">Explore Further Technology/);
  assert.match(page, /class="path-offer">Engineering Services<\/div>/);
  assert.match(page, /class="path-offer">Custom Software<\/div>/);
});

test('the mission pages share one accessible shell while preserving stage identity', () => {
  const stages = {
    'enter/index.html': 'stage-enter',
    'services/index.html': 'stage-sustain',
    'further/index.html': 'stage-further',
  };

  Object.entries(stages).forEach(([path, stageClass]) => {
    const html = readFileSync(resolve(root, path), 'utf8');
    assert.match(html, new RegExp(`<body class="${stageClass}">`));
    assert.match(html, /<nav aria-label="Primary">/);
    assert.match(html, /class="nav-logo" aria-label="Twilight Technology home"/);
    assert.match(html, /class="nav-mark"[^>]*alt=""/);
    assert.match(html, /class="mob-tog" type="button" aria-label="Open menu"/);
    assert.match(html, /class="skip-link" href="#main-content"/);
    assert.match(html, /<main class="shell" id="main-content" tabindex="-1">/);
  });
});

test('Enter separates available starting points from role environments still in development', () => {
  const page = readFileSync(resolve(root, 'enter/index.html'), 'utf8');
  assert.match(page, /Practice the work before someone hands you/);
  assert.match(page, /Available now/);
  assert.match(page, /In development/);
  assert.match(page, /Selected · not yet live/);
  assert.match(page, /Help Desk will be the first Role Lab/);
  assert.match(page, /scenarios, guidance, evidence model, and delivery format still have to be built and tested/i);
  assert.match(page, /Later candidate \/\/ Security Operations/);
  assert.match(page, /simulated, bounded environments/i);
  assert.match(page, /does not provide production access/i);
  assert.match(page, /does not .* guarantee certification or employment/i);
  assert.match(page, /href="\/roadmap\/"/);
  assert.match(page, /href="\/homelab-starter\/"/);
  assert.match(page, /href="\/guides\/"/);
  assert.match(page, /href="\/strategy\/"/);
  assert.match(page, /class="skip-link" href="#main-content"/);
  assert.match(page, /<main class="shell" id="main-content" tabindex="-1">/);
});

test('Further is the engineering-practice gateway without flattening reference systems into products', () => {
  const page = readFileSync(resolve(root, 'further/index.html'), 'utf8');
  assert.match(page, /Engineering Services/);
  assert.match(page, /AI Solutions/);
  assert.match(page, /Custom Software/);
  assert.match(page, /reference systems, not identical off-the-shelf customer products/i);
  assert.match(page, /do not automatically represent packaged products, production readiness, or customer results/i);
  assert.match(page, /class="skip-link" href="#main-content"/);
  assert.match(page, /<main class="shell" id="main-content" tabindex="-1">/);
  assert.match(page, /href="\/ai\/yours\/"/);
  assert.match(page, /href="\/labs\/"/);
});

test('AI Solutions opens with the offer name and a stable campaign intake link', () => {
  const page = readFileSync(resolve(root, 'ai/yours/index.html'), 'utf8');
  assert.match(page, /<div class="sol-kicker">Twilight Technology · Atlanta<\/div>/);
  assert.match(page, /<h1 class="sol-title"><span class="glow">AI Solutions<\/span><\/h1>/);
  assert.match(page, /complimentary 30-minute AI Opportunity Review/i);
  assert.match(page, /Request the review →/);
  assert.match(page, /one workflow, no generic AI sales pitch/i);
  assert.doesNotMatch(page, /six tabs and one person's head/i);
  assert.match(page, /<section[^>]+id="start"/);
  assert.match(page, /href="#start"/);
});

test('AI Solutions uses the qualified system evidence set and states its boundaries', () => {
  const page = readFileSync(resolve(root, 'ai/yours/index.html'), 'utf8');
  const requiredEvidence = [
    'war-room-floor-truth.png',
    'war-room-command-controls.png',
    'war-room-cold-truth.png',
    'brightpath-observatory.jpg',
    'brightpath-workshop.jpg',
    'brightpath-office.jpg',
    'jbot-work-truth.jpg',
    'jbot-approval-center.png',
    'jbot-capability-live.png',
    'hackbot-scoreboard.png',
    'outreach-hub.png',
    'tabletop-qualified-hud.png',
    'aptsu-needs-dashboard.png',
  ];

  requiredEvidence.forEach((asset) => {
    assert.match(page, new RegExp(`/assets/solutions/${asset.replace('.', '\\.')}`));
  });
  assert.doesNotMatch(page, /hackbot-arsenal\.jpg|jbot-integration\.jpg/);
  assert.match(page, /Our proof standard/i);
  assert.equal((page.match(/<details class="proof-more">/g) || []).length, 3);
  assert.match(page, /research and simulated execution only/i);
  assert.match(page, /verified rules and adult oversight control progress/i);
  assert.match(page, /Current work is separated from retained reports/i);
  assert.match(page, /Private staging with demonstration data/i);
  assert.match(page, /Map your workflow →/i);
  assert.doesNotMatch(page, /September qualification pass|DarkCloud|Prime\/Tower|paper and shadow research|Private Tailnet staging/i);
  assert.match(page, /class="skip-link" href="#main-content"/);
  assert.match(page, /<main class="shell" id="main-content" tabindex="-1">/);
  assert.match(page, /class="active" aria-current="page" href="\/further\/"/);
  assert.doesNotMatch(page, /\.sol-answer:focus[^}]+outline:none/);
});

test('the homepage headline and navigation stay inside narrow phone viewports', () => {
  assert.match(homePage, /font-size:clamp\(1\.15rem,6\.3vw,1\.75rem\)/);
  assert.match(homePage, /\.mission-line\{width:100%;white-space:nowrap\}/);
  assert.match(homePage, /site\.css\?v=20260901-mobile-home/);
  assert.match(siteStyles, /\.nav-inner\{padding:0 1rem\}/);
  assert.match(siteStyles, /\.nav-logo\{font-size:\.86rem;letter-spacing:1\.8px\}/);
});

test('shared navigation and motion respect keyboard and user preferences', () => {
  assert.match(siteRuntime, /aria-expanded/);
  assert.match(siteRuntime, /event\.key !== 'Escape'/);
  assert.match(siteRuntime, /prefers-reduced-motion: reduce/);
  assert.match(siteStyles, /a:focus-visible,button:focus-visible/);
  assert.match(siteStyles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(siteStyles, /\.form-group input:focus[^}]+outline:none/);
});

test('managed plans and one-time fixes share one service desk', () => {
  const page = readFileSync(resolve(root, 'services/index.html'), 'utf8');
  const legacyPage = readFileSync(resolve(root, 'managed-it/index.html'), 'utf8');

  assert.match(page, /id="managed-plans"/);
  assert.match(page, /Choose the depth of <span class="ac">operating care\.<\/span>/);
  assert.match(page, /Essentials, Secure, and Sentinel increase the level/);
  assert.match(page, /id="one-time-services"/);
  assert.match(page, /Pay for the fix, <span class="ac">not a subscription<\/span>/);
  assert.match(page, /id="svc-menu"/);
  assert.match(legacyPage, /url=\/services\/#managed-plans/);
  assert.match(legacyPage, /location\.replace\('\/services\/#managed-plans'\)/);
});

test('Sustain opens as an operations floor before presenting the service catalog', () => {
  const page = readFileSync(resolve(root, 'services/index.html'), 'utf8');

  assert.match(page, /Stage 02 \/\/ Sustain Technology/);
  assert.match(page, /Keep the business running <span class="steady">after the handoff\.<\/span>/);
  assert.match(page, /class="continuity-board reveal"/);
  assert.match(page, /Identity[\s\S]*Controlled/);
  assert.match(page, /Endpoints[\s\S]*Accounted for/);
  assert.match(page, /Recovery[\s\S]*Testable/);
  assert.match(page, /Support[\s\S]*Owned/);
  assert.equal((page.match(/class="orbit-label /g) || []).length, 4);
  assert.doesNotMatch(page, /class="status-node"|class="operating-lane"/);
  assert.match(page, /id="engagement-paths"/);
  assert.match(page, /Stabilize one problem/);
  assert.match(page, /Operate it with us/);
  assert.match(page, /Exact deliverables depend on the agreed scope/);
  assert.match(page, /<details class="receipt-strip reveal">/);
  assert.match(page, /<details class="plan-comparison reveal">/);
  assert.doesNotMatch(page, /Four steps,[\s\S]*no surprises|Three doors,[\s\S]*not nineteen/);
  assert.match(page, /class="skip-link" href="#main-content"/);
  assert.match(page, /<main class="shell" id="main-content" tabindex="-1">/);
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

test('every page-level Front Desk trigger opens the shared widget directly', () => {
  assert.match(widget, /querySelectorAll\('\[data-open-jbot\]'\)/);
  assert.match(widget, /setOpen\(root, panel, launcher, true, true\)/);

  const siteChat = readFileSync(resolve(root, 'site-chat/index.html'), 'utf8');
  assert.doesNotMatch(siteChat, /getElementById\('jbot-launcher'\)/);
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
    assert.match(html, /jbot-frontdesk-content\.js\?v=20261021-frontdesk-v6/);
    assert.match(html, /jbot-widget\.js\?v=20261021-frontdesk-v6/);
    assert.ok(
      html.indexOf('jbot-frontdesk-content.js') < html.indexOf('jbot-widget.js'),
      `content must load before widget: ${path}`,
    );
  });
});
