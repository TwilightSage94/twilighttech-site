const LABS_URL = "https://twilight-tech-labs.twilightsage.chatgpt.site/";

export function onRequest() {
  return Response.redirect(LABS_URL, 302);
}
