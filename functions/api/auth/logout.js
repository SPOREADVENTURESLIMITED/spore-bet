import { clearSessionCookie, json, readCookie, sha256 } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  if (env.DB) {
    const token = readCookie(request, "spore_session");
    if (token && token.length <= 128) {
      try {
        const tokenHash = await sha256(token);
        await env.DB.prepare(
          "UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL"
        ).bind(tokenHash).run();
      } catch {
        return json({ error: "Could not safely end the session. Please retry." }, 503);
      }
    }
  }
  return json({ message: "Signed out." }, 200, { "Set-Cookie": clearSessionCookie });
}
