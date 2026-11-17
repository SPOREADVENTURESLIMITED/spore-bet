import { createSession, hashPassword, json, sessionCookie, consumeRateLimit } from "../_auth.js";

async function constantTimeTokenMatch(provided, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  if (typeof env.ADMIN_BOOTSTRAP_TOKEN !== "string" || env.ADMIN_BOOTSTRAP_TOKEN.length < 32 ||
      typeof env.ADMIN_BOOTSTRAP_EMAIL !== "string" || !env.ADMIN_BOOTSTRAP_EMAIL.trim()) {
    return json({ error: "First-administrator setup is not configured. Contact the platform administrator." }, 503);
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "Send activation details as JSON." }, 415);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const token = typeof body.bootstrapToken === "string" ? body.bootstrapToken : "";

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email !== env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase()) {
    return json({ error: "The administrator email does not match the configured first-admin identity." }, 400);
  }
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return json({ error: "Phone must use international format, for example +256700000000." }, 400);
  }
  if (displayName.length < 2 || displayName.length > 80) return json({ error: "Name must be 2–80 characters." }, 400);
  if (password.length < 12 || password.length > 128) return json({ error: "Password must be 12–128 characters." }, 400);
  if (token.length < 32 || token.length > 256) return json({ error: "Enter the one-time setup token." }, 400);

  try {
    const allowed = await consumeRateLimit(env.DB, request, "admin-bootstrap", "first-admin", 5, 3600);
    if (!allowed) return json({ error: "Too many setup attempts. Try again in an hour." }, 429);
  } catch {
    return json({ error: "Administrator setup is temporarily unavailable." }, 503);
  }

  let tokenMatches = false;
  try { tokenMatches = await constantTimeTokenMatch(token, env.ADMIN_BOOTSTRAP_TOKEN); }
  catch { return json({ error: "Administrator setup is temporarily unavailable." }, 503); }
  if (!tokenMatches) return json({ error: "Invalid one-time setup token." }, 403);

  const userId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE admin_bootstrap
         SET consumed_at = datetime('now'), consumed_by = ?
         WHERE id = 1 AND consumed_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')`
      ).bind(attemptId),
      env.DB.prepare(
        `INSERT INTO users (id, email, phone, password_hash, display_name, status, role)
         SELECT ?, ?, ?, ?, ?, 'active', 'admin'
         WHERE EXISTS (SELECT 1 FROM admin_bootstrap WHERE id = 1 AND consumed_by = ?)`
      ).bind(userId, email, phone || null, passwordHash, displayName, attemptId),
      env.DB.prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata_json)
         SELECT ?, ?, 'first_admin_bootstrapped', 'user', ?, ?
         WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin')`
      ).bind(crypto.randomUUID(), userId, userId, JSON.stringify({ method: "one_time_cloudflare_secret" }), userId)
    ]);
    const created = await env.DB.prepare(
      "SELECT id, email, phone, display_name AS displayName, role, status FROM users WHERE id = ? AND role = 'admin'"
    ).bind(userId).first();
    if (!created) return json({ error: "First-admin setup has already been used or an administrator already exists." }, 409);

    const session = await createSession(env.DB, userId);
    return json({
      message: "First administrator created. Complete authenticator-app MFA before opening the dashboard.",
      mfaSetupRequired: true,
      user: created
    }, 201, { "Set-Cookie": sessionCookie(session) });
  } catch {
    return json({ error: "Administrator account could not be created. Check whether this email or phone is already registered." }, 409);
  }
}
