import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const receiverSource = readFileSync(new URL('../integrations/google-apps-script/jbot-leads.gs', import.meta.url), 'utf8');

test('Apps Script saves once and recovers a failed notification on duplicate retry', () => {
  const properties = new Map([
    ['SHARED_SECRET', 'receiver-secret'],
    ['SHEET_ID', 'customer-sheet'],
    ['NOTIFICATION_EMAIL', 'owner@customer.example'],
  ]);
  const rows = [];
  const cellValues = new Map();
  let emailAttempts = 0;

  const sheet = {
    getLastRow: () => 5 + rows.length,
    getRange(row, column) {
      return {
        copyTo() {},
        setNumberFormat() {},
        setValues(values) { rows.push({ row, values: values[0] }); },
        setValue(value) { cellValues.set(`${row}:${column}`, value); },
      };
    },
  };
  const propertyApi = {
    getProperty: (key) => properties.get(key) || '',
    getProperties: () => Object.fromEntries(properties),
    setProperty: (key, value) => properties.set(key, value),
    deleteProperty: (key) => properties.delete(key),
    setProperties: (values) => Object.entries(values).forEach(([key, value]) => properties.set(key, value)),
  };
  const lock = { tryLock: () => true, hasLock: () => true, releaseLock() {} };
  const sandbox = {
    PropertiesService: { getScriptProperties: () => propertyApi },
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: {
      CopyPasteType: { PASTE_FORMAT: 'format', PASTE_DATA_VALIDATION: 'validation' },
      openById: (id) => {
        assert.equal(id, 'customer-sheet');
        return { getSheetByName: () => sheet };
      },
      flush() {},
    },
    MailApp: {
      sendEmail() {
        emailAttempts += 1;
        if (emailAttempts === 1) throw new Error('synthetic Gmail outage');
      },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      getUuid: () => '12345678-1234-1234-1234-123456789abc',
      formatDate: () => '20261102-120000',
      computeDigest: (_algorithm, value) => Array.from(createHash('sha256').update(value).digest(), (byte) => byte > 127 ? byte - 256 : byte),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'fallback@example.com' }) },
    console,
  };
  runInNewContext(`${receiverSource}\n;globalThis.__receiver = { doPost };`, sandbox);

  const payload = {
    shared_secret: 'receiver-secret',
    request_id: 'stable-request-1234',
    lane: 'Website Chat / Intake',
    name: 'Synthetic Visitor',
    email: 'visitor@example.com',
    need: 'Synthetic test only',
  };
  const event = { postData: { contents: JSON.stringify(payload) } };
  const first = JSON.parse(sandbox.__receiver.doPost(event).text);
  assert.deepEqual({ ok: first.ok, lead_saved: first.lead_saved, email_sent: first.email_sent }, { ok: true, lead_saved: true, email_sent: false });
  assert.equal(rows.length, 1);
  assert.equal(cellValues.get('6:13'), 'Failed');

  const retry = JSON.parse(sandbox.__receiver.doPost(event).text);
  assert.deepEqual({ ok: retry.ok, duplicate: retry.duplicate, lead_saved: retry.lead_saved, email_sent: retry.email_sent }, { ok: true, duplicate: true, lead_saved: true, email_sent: true });
  assert.equal(rows.length, 1, 'retry must not append a duplicate lead row');
  assert.equal(cellValues.get('6:13'), 'Sent');
  assert.equal(emailAttempts, 2);

  const conflicting = JSON.parse(sandbox.__receiver.doPost({
    postData: { contents: JSON.stringify({ ...payload, need: 'Different payload with reused ID' }) },
  }).text);
  assert.deepEqual({ ok: conflicting.ok, error: conflicting.error }, { ok: false, error: 'Request ID conflict.' });
  assert.equal(rows.length, 1);
});
