const SUPPORT_HOST = 'support.twilighttech.io';

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  if (requestUrl.hostname.toLowerCase() !== SUPPORT_HOST) {
    return context.next();
  }

  const supportUrl = new URL('/support/index.html', requestUrl);
  return context.env.ASSETS.fetch(new Request(supportUrl, context.request));
}
