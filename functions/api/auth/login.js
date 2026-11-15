import { createSession, json, sessionCookie, verifyPassword } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "Send login details as JSON." }, 415);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || identifier.length > 254 || !password || password.length > 128) {
    return json({ error: "Invalid email/phone or password." }, 400);
  }

  try {
    const user = await env.DB.prepare(
      `SELECT id, email, phone, display_name AS displayName, password_hash, role, status
       FROM users WHERE lower(email) = ? OR phone = ? LIMIT 1`
    ).bind(identifier, identifier).first();

    if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
      return json({ error: "Invalid email/phone or password." }, 401);
    }
    const token = await createSession(env.DB, user.id);
    await env.DB.prepare(
      "INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'login_success', 'user', ?)"
    ).bind(crypto.randomUUID(), user.id, user.id).run();

    return json({
      message: "Signed in.",
      user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName, role: user.role }
    }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch {
    return json({ error: "Login is temporarily unavailable." }, 503);
  }
}
