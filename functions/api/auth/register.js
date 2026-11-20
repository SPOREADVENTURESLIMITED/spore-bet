import { createSession, hashPassword, json, sessionCookie, consumeRateLimit } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) return json({ error: "Send registration details as JSON." }, 415);
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "";
  if ((!email && !phone) || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || (phone && !/^\+[1-9]\d{7,14}$/.test(phone))) return json({ error: "Provide a valid email address or phone in international format." }, 400);
  if (displayName.length < 2 || displayName.length > 80) return json({ error: "Name must be 2–80 characters." }, 400);
  if (password.length < 12 || password.length > 128) return json({ error: "Password must be 12–128 characters." }, 400);
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return json({ error: "Country code must be two letters." }, 400);
  try {
    if (!(await consumeRateLimit(env.DB, request, "register-ip", "all", 5, 3600))) return json({ error: "Too many registration attempts. Try again in an hour." }, 429);
  } catch { return json({ error: "Registration is temporarily unavailable." }, 503); }
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO users (id, email, phone, password_hash, display_name, country_code, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`).bind(userId, email || null, phone || null, passwordHash, displayName, countryCode || null),
      env.DB.prepare("INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'customer_registered', 'user', ?)").bind(crypto.randomUUID(), userId, userId)
    ]);
    const token = await createSession(env.DB, userId);
    return json({
      message: "Account created. Wallet funding and wagering are not yet available.",
      user: { id: userId, email: email || null, phone: phone || null, displayName, role: "customer" },
      wallet: null,
      wageringAvailable: false
    }, 201, { "Set-Cookie": sessionCookie(token) });
  } catch {
    return json({ error: "An account with those details may already exist, or registration is temporarily unavailable." }, 409);
  }
}
