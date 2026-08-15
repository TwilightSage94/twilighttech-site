const LABS_URL = "https://labs.twilighttech.io/";

export function onRequest() {
  return Response.redirect(LABS_URL, 302);
}
