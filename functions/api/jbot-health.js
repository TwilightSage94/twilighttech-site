function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  });
}

function configured(value) {
  return Boolean(String(value || '').trim());
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const turnstileReady = configured(env.TURNSTILE_SITE_KEY) && configured(env.TURNSTILE_SECRET_KEY);
  const deliveryReady = configured(env.JBOT_GOOGLE_ENDPOINT) && configured(env.JBOT_GOOGLE_SECRET);
  const ready = turnstileReady && deliveryReady;

  return json({
    ok: ready,
    service: 'jbot-frontdesk',
    status: ready ? 'ready' : 'misconfigured',
    checks: {
      turnstile: turnstileReady,
      google_delivery: deliveryReady,
      rate_limit: env.JBOT_RATE_LIMITER && typeof env.JBOT_RATE_LIMITER.limit === 'function'
        ? 'binding'
        : (env.JBOT_RATE_LIMIT_KV && typeof env.JBOT_RATE_LIMIT_KV.get === 'function' ? 'kv' : 'isolate-fallback'),
    },
  }, ready ? 200 : 503);
}

export async function onRequest() {
  return json({ ok: false, error: 'Method not allowed.' }, 405);
}
