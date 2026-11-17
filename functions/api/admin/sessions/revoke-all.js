import { clearSessionCookie, currentUser, json } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "Send an empty JSON object." }, 415);
  }
  try {
    const actor = await currentUser(request, env.DB);
    if (!actor) return json({ error: "Authentication required." }, 401);
    if (actor.role !== "admin") return json({ error: "Administrator access required." }, 403);
    if (!actor.adminMfaVerified) return json({ error: "Administrator MFA verification is required.", code: "MFA_REQUIRED" }, 403);

    const results = await env.DB.batch([
      env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE role='admin')"),
      env.DB.prepare("INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id) VALUES (?,?,'admin_sessions_revoked','session','all-admin-sessions')").bind(crypto.randomUUID(), actor.id)
    ]);
    const revokedSessions = results[0]?.meta?.changes || 0;
    return json({ message: "All administrator sessions have been revoked. Sign in again.", revokedSessions }, 200, { "Set-Cookie": clearSessionCookie });
  } catch {
    return json({ error: "Administrator sessions could not be safely revoked. Please retry." }, 503);
  }
}
