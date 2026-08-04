const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

const ALLOWED_LANES = {
  'private-ai': 'Private AI',
  'site-chat': 'Website Chat / Intake',
  'system-care': 'System Care',
  'guides': 'Guides / Freebies',
  'breakroom': 'BreakRoom',
  'aptsu': 'A Place To Show Up',
  'general': 'General',
};

const LIMITS = {
  name: 90,
  email: 160,
  lane: 40,
  need: 700,
  urgency: 80,
  summary: 900,
  next_step: 180,
  safety_note: 220,
  hp: 120,
  page: 300,
  turnstile_token: 2048,
};

const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\bpasscode\b/i,
  /\bapi[_\s-]?key\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bssn\b/i,
  /\bsocial security\b/i,
  /\bcredit card\b/i,
  /\bprivate key\b/i,
  /\bcustody\b/i,
  /\bmedical record\b/i,
  /\bclient file\b/i,
];

const buckets = new Map();

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = (env.JBOT_ALLOWED_ORIGINS || 'https://twilighttech.io,http://localhost:8000,http://127.0.0.1:8000')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin || configured.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || 'https://twilighttech.io',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '600',
    };
  }

  return {
    'Access-Control-Allow-Origin': 'https://twilighttech.io',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '600',
  };
}

function truncate(value, max) {
  const text = String(value || '').trim();
  if (!max || text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function neutralize(value, max) {
  return truncate(value, max)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function slugLane(value) {
  const raw = neutralize(value, LIMITS.lane).toLowerCase();
  let slug = raw
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (ALLOWED_LANES[slug]) return slug;

  Object.keys(ALLOWED_LANES).some((key) => {
    if (ALLOWED_LANES[key].toLowerCase() === raw) {
      slug = key;
      return true;
    }
    return false;
  });

  return ALLOWED_LANES[slug] ? slug : 'general';
}

function isEmail(value) {
  const email = neutralize(value, LIMITS.email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function hasSensitiveContent(text) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function normalizeLead(input) {
  const laneSlug = slugLane(input.lane);
  const need = neutralize(input.need, LIMITS.need);
  const summary = neutralize(input.summary, LIMITS.summary);

  return {
    name: neutralize(input.name, LIMITS.name),
    email: neutralize(input.email, LIMITS.email).toLowerCase(),
    lane: ALLOWED_LANES[laneSlug],
    lane_slug: laneSlug,
    need,
    urgency: neutralize(input.urgency, LIMITS.urgency),
    summary,
    next_step: neutralize(input.next_step, LIMITS.next_step),
    safety_note: neutralize(input.safety_note, LIMITS.safety_note),
    hp: neutralize(input.hp, LIMITS.hp),
    page: neutralize(input.page, LIMITS.page),
    turnstile_token: neutralize(input.turnstile_token, LIMITS.turnstile_token),
    sensitive_flag: hasSensitiveContent([need, summary, input.next_step].join(' ')),
  };
}

function compactSummary(lead) {
  return truncate([
    lead.name ? `Name: ${lead.name}` : '',
    lead.lane ? `Lane: ${lead.lane}` : '',
    lead.need ? `Need: ${lead.need}` : '',
    lead.urgency ? `Urgency: ${lead.urgency}` : '',
    lead.next_step ? `Next: ${lead.next_step}` : '',
  ].filter(Boolean).join(' | '), 450);
}

function validateLead(lead) {
  const errors = [];
  const warnings = [];

  if (lead.hp) errors.push('Bot check failed.');
  if (!lead.email) errors.push('Email is required.');
  else if (!isEmail(lead.email)) errors.push('Email does not look valid.');
  if (!ALLOWED_LANES[lead.lane_slug]) errors.push('Invalid route selected.');
  if (!lead.turnstile_token) errors.push('Security verification is required.');
  if (lead.sensitive_flag) {
    warnings.push('Sensitive terms detected. Review before replying.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

function rateLimitKey(request, lead) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  return `${ip}:${lead.email || 'no-email'}`;
}

function checkRateLimit(key) {
  const now = Date.now();
  const existing = buckets.get(key) || [];
  const fresh = existing.filter((stamp) => now - stamp < RATE_WINDOW_MS);
  fresh.push(now);
  buckets.set(key, fresh);
  return fresh.length <= RATE_MAX;
}

function buildGooglePayload(lead, request, sharedSecret) {
  const safetyNote = lead.safety_note || (lead.sensitive_flag
    ? 'Sensitive terms detected. Review before replying.'
    : 'No sensitive files requested in chat.');

  return {
    shared_secret: sharedSecret,
    name: lead.name,
    email: lead.email,
    lane: lead.lane,
    need: lead.need,
    urgency: lead.urgency,
    page: lead.page,
    summary: lead.summary || compactSummary(lead),
    next_step: lead.next_step,
    safety_note: safetyNote,
    sensitive_flag: lead.sensitive_flag,
    referrer: neutralize(request.headers.get('Referer') || '', 300),
  };
}

async function deliverToGoogle(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  let result;
  try {
    result = await response.json();
  } catch (error) {
    return { ok: false, lead_saved: false, email_sent: false };
  }
  return {
    ok: response.ok && result.ok === true,
    lead_saved: result.lead_saved === true,
    email_sent: result.email_sent === true,
  };
}

async function verifyTurnstile(secret, token, remoteIp) {
  const payload = new FormData();
  payload.append('secret', secret);
  payload.append('response', token);
  if (remoteIp) payload.append('remoteip', remoteIp);
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    payload.append('idempotency_key', crypto.randomUUID());
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: payload,
  });

  if (!response.ok) return { success: false, 'error-codes': ['siteverify-unavailable'] };
  return response.json();
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = corsHeaders(request, env);

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, error: 'Invalid JSON.' }, 400, headers);
  }

  const lead = normalizeLead(body || {});
  const validation = validateLead(lead);
  if (!validation.ok) {
    return json({ ok: false, errors: validation.errors }, 400, headers);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return json({ ok: false, error: 'Security verification is unavailable.' }, 503, headers);
  }

  let turnstileResult;
  try {
    turnstileResult = await verifyTurnstile(
      env.TURNSTILE_SECRET_KEY,
      lead.turnstile_token,
      request.headers.get('CF-Connecting-IP') || '',
    );
  } catch (error) {
    return json({ ok: false, error: 'Security verification is unavailable.' }, 503, headers);
  }

  if (!turnstileResult.success) {
    return json({ ok: false, error: 'Security verification failed. Please try again.' }, 403, headers);
  }

  if (!checkRateLimit(rateLimitKey(request, lead))) {
    return json({ ok: false, error: 'Too many submissions. Please wait and try again.' }, 429, headers);
  }

  if (!env.JBOT_GOOGLE_ENDPOINT || !env.JBOT_GOOGLE_SECRET) {
    return json({ ok: false, error: 'Google lead delivery is not configured.' }, 503, headers);
  }

  let delivery;
  try {
    delivery = await deliverToGoogle(
      env.JBOT_GOOGLE_ENDPOINT,
      buildGooglePayload(lead, request, env.JBOT_GOOGLE_SECRET),
    );
  } catch (error) {
    return json({ ok: false, error: 'Google lead delivery is unavailable.' }, 503, headers);
  }

  const leadSaved = delivery.ok && delivery.lead_saved;
  const emailSent = delivery.ok && delivery.email_sent;

  if (!leadSaved && !emailSent) {
    return json({ ok: false, error: 'Delivery failed.' }, 502, headers);
  }

  return json({
    ok: true,
    lead_saved: leadSaved,
    email_sent: emailSent,
    warnings: validation.warnings,
  }, 200, headers);
}

export async function onRequest(context) {
  return json({ ok: false, error: 'Method not allowed.' }, 405, {
    ...corsHeaders(context.request, context.env),
    Allow: 'POST, OPTIONS',
  });
}
