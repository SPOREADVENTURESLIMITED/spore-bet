export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const unsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (url.pathname.startsWith("/api/") && unsafeMethod &&
      ((origin && origin !== url.origin) || fetchSite === "cross-site")) {
    return Response.json({ error: "Cross-origin request rejected." }, {
      status: 403,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  }
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  if (new URL(request.url).pathname.startsWith("/api/")) {
    headers.set("Cache-Control", "no-store");
  }
  const body = [204, 205, 304].includes(response.status) ? null : response.body;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
