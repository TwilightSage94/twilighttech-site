const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const MAX_BODY_BYTES = 16_384;
const DELIVERY_TIMEOUT_MS = 8_000;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://twilighttech.io',
  'https://www.twilighttech.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];
const DEFAULT_TURNSTILE_HOSTNAMES = ['twilighttech.io', 'www.twilighttech.io'];

const ALLOWED_LANES = {
  'private-ai': 'Private AI',
  'site-chat': 'Website Chat / Intake',
  'system-care': 'System Care',
  'guides': 'Guides / Freebies',
  'breakroom': 'BreakRoom',
  'aptsu': 'A Place To Show Up',
  'personal-ai': 'Personal AI Assistant',
  'solutions': 'Twilight Tech Solutions',
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
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      ...headers,
    },
  });
}

function configuredList(value, defaults) {
  const items = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return items.length ? items : defaults;
}

function allowedOrigins(env) {
  return configuredList(env.JBOT_ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS);
}

function originAllowed(request, env) {
  const origin = request.headers.get('Origin') || '';
  return !origin || allowedOrigins(env).includes(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '600',
  };
  if (originAllowed(request, env)) {
    headers['Access-Control-Allow-Origin'] = origin || allowedOrigins(env)[0];
  }
  return headers;
}

function newRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `jbot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readJsonBody(request) {
  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_BODY_BYTES) throw new Error('request-too-large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('request-too-large');
  return JSON.parse(raw);
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

function checkMemoryRateLimit(key) {
  const now = Date.now();
  const existing = buckets.get(key) || [];
  const fresh = existing.filter((stamp) => now - stamp < RATE_WINDOW_MS);
  fresh.push(now);
  buckets.set(key, fresh);
  return fresh.length <= RATE_MAX;
}

async function hashRateLimitKey(key) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return key.slice(0, 64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function checkRateLimit(context, key) {
  const hashedKey = await hashRateLimitKey(key);
  const limiter = context.env.JBOT_RATE_LIMITER;
  if (limiter && typeof limiter.limit === 'function') {
    try {
      const result = await limiter.limit({ key: hashedKey });
      return result.success !== false;
    } catch (error) {
      console.warn(JSON.stringify({ event: 'jbot_rate_limit_fallback', request_id: context.requestId }));
    }
  }
  const kv = context.env.JBOT_RATE_LIMIT_KV;
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    try {
      const windowId = Math.floor(Date.now() / RATE_WINDOW_MS);
      const storageKey = `jbot-rate:${windowId}:${hashedKey}`;
      const count = Number(await kv.get(storageKey)) || 0;
      if (count >= RATE_MAX) return false;
      await kv.put(storageKey, String(count + 1), { expirationTtl: 120 });
      return true;
    } catch (error) {
      console.warn(JSON.stringify({ event: 'jbot_rate_limit_kv_fallback', request_id: context.requestId }));
    }
  }
  return checkMemoryRateLimit(key);
}

function buildGooglePayload(lead, request, sharedSecret, requestId) {
  const safetyNote = lead.safety_note || (lead.sensitive_flag
    ? 'Sensitive terms detected. Review before replying.'
    : 'No sensitive files requested in chat.');

  return {
    shared_secret: sharedSecret,
    request_id: requestId,
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

async function deliverToGoogle(endpoint, payload, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
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

function turnstileResultAllowed(result, env) {
  if (!result || result.success !== true || result.action !== 'jbot_lead') return false;
  const allowedHostnames = configuredList(env.TURNSTILE_ALLOWED_HOSTNAMES, DEFAULT_TURNSTILE_HOSTNAMES);
  return !result.hostname || allowedHostnames.includes(result.hostname);
}

function deliveryTimeout(env) {
  const configured = Number(env.JBOT_DELIVERY_TIMEOUT_MS || DELIVERY_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DELIVERY_TIMEOUT_MS;
  return Math.max(1_000, Math.min(configured, 15_000));
}

export async function onRequestOptions(context) {
  if (!originAllowed(context.request, context.env)) {
    return json({ ok: false, error: 'Origin not allowed.' }, 403, corsHeaders(context.request, context.env));
  }
  return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = newRequestId();
  context.requestId = requestId;
  const headers = { ...corsHeaders(request, env), 'X-JBot-Request-ID': requestId };

  if (!originAllowed(request, env)) {
    return json({ ok: false, error: 'Origin not allowed.', request_id: requestId }, 403, headers);
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    const tooLarge = error && error.message === 'request-too-large';
    return json({ ok: false, error: tooLarge ? 'Request is too large.' : 'Invalid JSON.', request_id: requestId }, tooLarge ? 413 : 400, headers);
  }

  const lead = normalizeLead(body || {});
  const validation = validateLead(lead);
  if (!validation.ok) {
    return json({ ok: false, errors: validation.errors, request_id: requestId }, 400, headers);
  }

  if (!await checkRateLimit(context, rateLimitKey(request, lead))) {
    return json({ ok: false, error: 'Too many submissions. Please wait and try again.', request_id: requestId }, 429, { ...headers, 'Retry-After': '60' });
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return json({ ok: false, error: 'Security verification is unavailable.', request_id: requestId }, 503, headers);
  }

  let turnstileResult;
  try {
    turnstileResult = await verifyTurnstile(
      env.TURNSTILE_SECRET_KEY,
      lead.turnstile_token,
      request.headers.get('CF-Connecting-IP') || '',
    );
  } catch (error) {
    return json({ ok: false, error: 'Security verification is unavailable.', request_id: requestId }, 503, headers);
  }

  if (!turnstileResultAllowed(turnstileResult, env)) {
    return json({ ok: false, error: 'Security verification failed. Please try again.', request_id: requestId }, 403, headers);
  }

  if (!env.JBOT_GOOGLE_ENDPOINT || !env.JBOT_GOOGLE_SECRET) {
    return json({ ok: false, error: 'Google lead delivery is not configured.', request_id: requestId }, 503, headers);
  }

  let delivery;
  try {
    delivery = await deliverToGoogle(
      env.JBOT_GOOGLE_ENDPOINT,
      buildGooglePayload(lead, request, env.JBOT_GOOGLE_SECRET, requestId),
      deliveryTimeout(env),
    );
  } catch (error) {
    console.error(JSON.stringify({ event: 'jbot_delivery_unavailable', request_id: requestId }));
    return json({ ok: false, error: 'Google lead delivery is unavailable.', request_id: requestId }, 503, headers);
  }

  const leadSaved = delivery.ok && delivery.lead_saved;
  const emailSent = delivery.ok && delivery.email_sent;

  if (!leadSaved && !emailSent) {
    console.error(JSON.stringify({ event: 'jbot_delivery_failed', request_id: requestId }));
    return json({ ok: false, error: 'Delivery failed.', request_id: requestId }, 502, headers);
  }

  console.log(JSON.stringify({ event: 'jbot_delivery_complete', request_id: requestId, lead_saved: leadSaved, email_sent: emailSent }));

  return json({
    ok: true,
    lead_saved: leadSaved,
    email_sent: emailSent,
    warnings: validation.warnings,
    request_id: requestId,
  }, 200, headers);
}

export async function onRequest(context) {
  return json({ ok: false, error: 'Method not allowed.' }, 405, {
    ...corsHeaders(context.request, context.env),
    Allow: 'POST, OPTIONS',
  });
}
