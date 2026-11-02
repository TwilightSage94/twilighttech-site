const SHEET_NAME = 'J-Bot Leads';
const TIME_ZONE = 'America/New_York';
const TEMPLATE_ROW = 5;
const COLUMN_COUNT = 14;
const REQUEST_PROPERTY_PREFIX = 'JBOT_REQUEST_';
const REQUEST_RECEIPT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function configureJBot(sheetId, notificationEmail) {
  const cleanSheetId = String(sheetId || '').trim();
  const cleanEmail = String(notificationEmail || '').trim().toLowerCase();
  if (!cleanSheetId) throw new Error('Pass the customer-owned Google Sheet ID.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) throw new Error('Pass the customer-owned notification email.');
  PropertiesService.getScriptProperties().setProperties({
    SHEET_ID: cleanSheetId,
    NOTIFICATION_EMAIL: cleanEmail,
  });
}

function setupJBot() {
  const properties = PropertiesService.getScriptProperties();
  const existingSecret = properties.getProperty('SHARED_SECRET');
  const sharedSecret = existingSecret || [Utilities.getUuid(), Utilities.getUuid()].join('-');
  const notificationEmail = properties.getProperty('NOTIFICATION_EMAIL') || '';
  const sheetId = properties.getProperty('SHEET_ID') || '';

  if (!sheetId || !notificationEmail) throw new Error('Run configureJBot(customerSheetId, customerNotificationEmail) before setupJBot.');

  properties.setProperties({
    SHARED_SECRET: sharedSecret,
  });

  console.log('JBOT_GOOGLE_SECRET=' + sharedSecret);
  console.log('Notification email=' + notificationEmail);
  console.log('Sheet ID=' + sheetId);
}

function doGet() {
  return jsonOutput({ ok: true, service: 'Twilight Tech J-Bot Leads' });
}

function doPost(event) {
  const lock = LockService.getScriptLock();

  try {
    const body = JSON.parse((event.postData && event.postData.contents) || '{}');
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('SHARED_SECRET') || '';

    if (!expectedSecret || !constantTimeEqual(body.shared_secret || '', expectedSecret)) {
      return jsonOutput({ ok: false, error: 'Unauthorized.' });
    }

    if (!lock.tryLock(10000)) {
      return jsonOutput({ ok: false, error: 'Lead desk is busy. Please retry.' });
    }

    pruneRequestReceipts(properties);

    const sheetId = properties.getProperty('SHEET_ID') || '';
    if (!sheetId) throw new Error('Customer Sheet ID is not configured.');
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('J-Bot Leads sheet not found.');

    const suppliedRequestId = safeRequestId(body.request_id);
    const requestId = suppliedRequestId || ('legacy-' + Utilities.getUuid());
    const payloadHash = payloadFingerprint(body);

    const existingReceipt = loadRequestReceipt(properties, requestId);
    if (existingReceipt && existingReceipt.lead_saved) {
      if (existingReceipt.payload_hash !== payloadHash) return jsonOutput({ ok: false, error: 'Request ID conflict.' });
      let emailSent = existingReceipt.email_sent === true;
      if (!emailSent && notificationAlreadySent(sheet, existingReceipt.row)) emailSent = true;
      if (!emailSent) {
        const retrySafetyNote = safeCell(body.safety_note || (body.sensitive_flag ? 'Sensitive terms detected. Review before replying.' : 'No sensitive terms detected.'));
        emailSent = sendNotification(properties, sheet, existingReceipt.row, body, existingReceipt.lead_id, retrySafetyNote);
        existingReceipt.email_sent = emailSent;
        saveRequestReceipt(properties, requestId, existingReceipt);
      }
      SpreadsheetApp.flush();
      return jsonOutput({ ok: true, duplicate: true, lead_saved: true, email_sent: emailSent, lead_id: existingReceipt.lead_id, idempotency: 'stable' });
    }

    const receivedAt = new Date();
    const leadId = 'JB-' + Utilities.formatDate(receivedAt, TIME_ZONE, 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8);
    const safetyNote = safeCell(body.safety_note || (body.sensitive_flag ? 'Sensitive terms detected. Review before replying.' : 'No sensitive terms detected.'));
    const summary = safeCell(body.summary || compactSummary(body));

    const row = [
      receivedAt,
      leadId,
      'New',
      safeCell(body.lane),
      safeCell(body.name),
      safeCell(body.email),
      safeCell(body.need),
      safeCell(body.urgency),
      safeCell(body.page),
      summary,
      safeCell(body.next_step),
      body.sensitive_flag ? 'Yes' : 'No',
      'Test pending',
      safetyNote,
    ];

    const targetRow = Math.max(sheet.getLastRow() + 1, TEMPLATE_ROW + 1);
    const templateRange = sheet.getRange(TEMPLATE_ROW, 1, 1, COLUMN_COUNT);
    const targetRange = sheet.getRange(targetRow, 1, 1, COLUMN_COUNT);
    templateRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    templateRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    targetRange.setValues([row]);
    sheet.getRange(targetRow, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    const receipt = { lead_saved: true, email_sent: false, lead_id: leadId, row: targetRow, payload_hash: payloadHash, saved_at: Date.now() };
    saveRequestReceipt(properties, requestId, receipt);

    const emailSent = sendNotification(properties, sheet, targetRow, body, leadId, safetyNote);
    receipt.email_sent = emailSent;
    saveRequestReceipt(properties, requestId, receipt);

    SpreadsheetApp.flush();
    return jsonOutput({
      ok: true,
      lead_saved: true,
      email_sent: emailSent,
      lead_id: leadId,
      idempotency: suppliedRequestId ? 'stable' : 'legacy-unavailable',
    });
  } catch (error) {
    return jsonOutput({ ok: false, error: 'Google lead delivery failed.' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function safeRequestId(value) {
  const requestId = String(value || '').trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,99}$/.test(requestId) ? requestId : '';
}

function requestPropertyKey(requestId) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, requestId, Utilities.Charset.UTF_8);
  const hex = digest.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
  return REQUEST_PROPERTY_PREFIX + hex;
}

function payloadFingerprint(body) {
  const bounded = [body.name, body.email, body.lane, body.need, body.urgency, body.page, body.summary, body.next_step].map(function (value) {
    return String(value || '').trim().slice(0, 1200);
  }).join('\n');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bounded, Utilities.Charset.UTF_8);
  return digest.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function loadRequestReceipt(properties, requestId) {
  const stored = properties.getProperty(requestPropertyKey(requestId));
  if (!stored) return null;
  try { return JSON.parse(stored); } catch (error) { return null; }
}

function saveRequestReceipt(properties, requestId, receipt) {
  receipt.saved_at = receipt.saved_at || Date.now();
  properties.setProperty(requestPropertyKey(requestId), JSON.stringify(receipt));
}

function pruneRequestReceipts(properties) {
  const now = Date.now();
  const all = properties.getProperties();
  Object.keys(all).forEach(function (key) {
    if (key.indexOf(REQUEST_PROPERTY_PREFIX) !== 0) return;
    try {
      const receipt = JSON.parse(all[key]);
      if (!receipt.saved_at || now - Number(receipt.saved_at) > REQUEST_RECEIPT_TTL_MS) properties.deleteProperty(key);
    } catch (error) {
      properties.deleteProperty(key);
    }
  });
}

function sendNotification(properties, sheet, targetRow, body, leadId, safetyNote) {
  try {
    const notificationEmail = properties.getProperty('NOTIFICATION_EMAIL') || '';
    if (!notificationEmail) throw new Error('Customer notification Gmail is not configured.');
    MailApp.sendEmail({
      to: notificationEmail,
      replyTo: safeEmail(body.email),
      name: 'J-Bot Front Desk',
      subject: 'New J-Bot Lead - ' + safeSubject(body.lane || 'General'),
      body: plainTextEmail(body, leadId, safetyNote),
      htmlBody: htmlEmail(body, leadId, safetyNote),
    });
    sheet.getRange(targetRow, 13).setValue('Sent');
    return true;
  } catch (emailError) {
    sheet.getRange(targetRow, 13).setValue('Failed');
    sheet.getRange(targetRow, 14).setValue(safetyNote + ' | Gmail error: ' + safeCell(emailError.message));
    return false;
  }
}

function notificationAlreadySent(sheet, targetRow) {
  return String(sheet.getRange(targetRow, 13).getValue() || '').trim().toLowerCase() === 'sent';
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function safeCell(value) {
  let text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 1200);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function safeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : Session.getEffectiveUser().getEmail();
}

function safeSubject(value) {
  return String(value || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80);
}

function constantTimeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^ (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
  }
  return mismatch === 0;
}

function compactSummary(body) {
  return [
    body.name ? 'Name: ' + body.name : '',
    body.lane ? 'Lane: ' + body.lane : '',
    body.need ? 'Need: ' + body.need : '',
    body.urgency ? 'Timing: ' + body.urgency : '',
    body.next_step ? 'Next: ' + body.next_step : '',
  ].filter(Boolean).join(' | ').slice(0, 900);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function plainTextEmail(body, leadId, safetyNote) {
  return [
    'New J-Bot Front Desk lead',
    '',
    'Lead ID: ' + leadId,
    'Lane: ' + safeCell(body.lane),
    'Name: ' + safeCell(body.name),
    'Email: ' + safeCell(body.email),
    'Need: ' + safeCell(body.need),
    'Timing: ' + safeCell(body.urgency),
    'Source page: ' + safeCell(body.page),
    'Next step: ' + safeCell(body.next_step),
    'Safety: ' + safetyNote,
    '',
    'Open the Twilight Tech - J-Bot Leads sheet for the permanent record.',
  ].join('\n');
}

function htmlEmail(body, leadId, safetyNote) {
  const rows = [
    ['Lead ID', leadId],
    ['Lane', body.lane],
    ['Name', body.name],
    ['Email', body.email],
    ['Need', body.need],
    ['Timing', body.urgency],
    ['Source page', body.page],
    ['Next step', body.next_step],
    ['Safety', safetyNote],
  ];
  return '<h2>New J-Bot Front Desk lead</h2><table cellpadding="8" cellspacing="0" style="border-collapse:collapse">' +
    rows.map(function (row) {
      return '<tr><th align="left" style="border-bottom:1px solid #ddd">' + escapeHtml(row[0]) + '</th><td style="border-bottom:1px solid #ddd">' + escapeHtml(row[1]) + '</td></tr>';
    }).join('') +
    '</table><p>Open <strong>Twilight Tech - J-Bot Leads</strong> for the permanent record.</p>';
}
