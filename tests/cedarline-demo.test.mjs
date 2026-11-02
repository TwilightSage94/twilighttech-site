import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../site-chat/demo/index.html', import.meta.url), 'utf8');
const content = readFileSync(new URL('../site-chat/demo/frontdesk-content.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../assets/frontdesk-runtime.js', import.meta.url), 'utf8');
const widget = readFileSync(new URL('../assets/frontdesk-widget.js', import.meta.url), 'utf8');
const demoStyle = readFileSync(new URL('../site-chat/demo/frontdesk-widget.css', import.meta.url), 'utf8');
const answers = JSON.parse(readFileSync(new URL('../site-chat/demo/frontdesk-public-answers.json', import.meta.url), 'utf8'));

test('the Cedarline route is explicitly fictional and self-contained', () => {
  assert.match(html, /Fictional business/i);
  assert.match(html, /Do not submit real information/i);
  assert.match(html, /\.\/frontdesk-content\.js/);
  assert.match(html, /\.\.\/\.\.\/assets\/frontdesk-widget\.js/);
  assert.match(content, /mode:\s*'synthetic-preview'/);
  assert.match(content, /prefixes:\s*\['\/site-chat\/demo'\]/);
  assert.match(content, /@cedarline\.demo\.invalid/);
});

test('the Cedarline preview cannot route or persist a real inquiry', () => {
  assert.doesNotMatch(content, /endpoints:\s*{[^}]*leads\s*:/s);
  assert.match(content, /Nothing was sent, saved, emailed, or added to a lead system\./);
  assert.match(runtime, /CONTENT\.mode === 'synthetic-preview'/);
  assert.match(runtime, /IS_SYNTHETIC_PREVIEW \? '' : '\/api\/frontdesk-leads'/);
  assert.match(runtime, /if \(!IS_SYNTHETIC_PREVIEW\) prepareTurnstile/);
  assert.match(runtime, /finishSyntheticPreview/);
  assert.match(runtime, /if \(IS_SYNTHETIC_PREVIEW\)\s*{/);
  assert.match(widget, /frontdesk-widget\.css/);
});

test('the Cedarline widget is white-labeled to the fictional site', () => {
  assert.match(widget, /CONTENT\.assets\.style/);
  assert.match(content, /style:\s*'\.\/frontdesk-widget\.css\?v=20261102-cedarline-v1'/);
  assert.match(demoStyle, /Cedarline's white-label skin/);
  assert.match(demoStyle, /--fd-panel:\s*#fffdf8/);
  assert.match(demoStyle, /--fd-green:\s*#214f42/);
  assert.match(demoStyle, /Georgia, "Times New Roman", serif/);
  assert.match(demoStyle, /simple Cedarline house mark/);
  assert.match(demoStyle, /focus-visible/);
});

test('the Cedarline answer registry is public-only and reviewable', () => {
  assert.ok(answers.revision);
  assert.ok(Array.isArray(answers.answers));
  assert.ok(answers.answers.length > 0);
  answers.answers.forEach((answer) => {
    assert.ok(answer.id);
    assert.ok(answer.reviewed_at);
    assert.ok(Array.isArray(answer.source_links));
    assert.ok(answer.source_links.length > 0);
    assert.equal(/@|\b\d{3}[-.)\s]+\d{3}[-.\s]+\d{4}\b/.test(JSON.stringify(answer)), false);
  });
});
