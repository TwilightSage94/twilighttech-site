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

export async function onRequestGet(context) {
  const sitekey = String(context.env.TURNSTILE_SITE_KEY || '').trim();
  if (!sitekey) {
    return json({ ok: false, error: 'Turnstile is not configured.' }, 503);
  }
  return json({ ok: true, sitekey });
}

export async function onRequest() {
  return json({ ok: false, error: 'Method not allowed.' }, 405);
}
