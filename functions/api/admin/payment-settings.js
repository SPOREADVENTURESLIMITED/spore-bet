import { currentUser, json } from "../_auth.js";

const SELECT = "SELECT airtel_merchant AS airtelMerchant, mtn_merchant AS mtnMerchant, bank_name AS bankName, bank_account_number AS accountNumber, bank_branch AS branch, bank_swift AS swift, updated_at AS updatedAt FROM payment_settings WHERE id=1";
const fields = ["airtelMerchant","mtnMerchant","bankName","accountNumber","branch","swift"];
const limits = { airtelMerchant:32, mtnMerchant:32, bankName:80, accountNumber:40, branch:80, swift:16 };

function valid(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return fields.every(key => typeof body[key] === "string" && body[key].trim().length > 0 && body[key].trim().length <= limits[key]);
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  try {
    const user = await currentUser(request, env.DB);
    if (!user) return json({ error: "Authentication required." }, 401);
    if (user.role !== "admin") return json({ error: "Administrator access required." }, 403);
    if (!user.adminMfaVerified) return json({ error: "Administrator MFA verification is required.", code: "MFA_REQUIRED" }, 403);
    const settings = await env.DB.prepare(SELECT).first();
    if (!settings) return json({ error: "Payment settings are not initialized." }, 503);
    return json({ settings, editable: true, realMoneyEnabled: false });
  } catch {
    return json({ error: "Payment settings are temporarily unavailable." }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "Send payment settings as JSON." }, 415);
  }
  try {
    const user = await currentUser(request, env.DB);
    if (!user) return json({ error: "Authentication required." }, 401);
    if (user.role !== "admin") return json({ error: "Administrator access required." }, 403);
    if (!user.adminMfaVerified) return json({ error: "Administrator MFA verification is required.", code: "MFA_REQUIRED" }, 403);
    const body = await request.json();
    if (!valid(body)) return json({ error: "Enter all six payment fields using valid text values." }, 400);
    const values = fields.map(key => body[key].trim());
    await env.DB.batch([
      env.DB.prepare(`UPDATE payment_settings SET airtel_merchant=?,mtn_merchant=?,bank_name=?,bank_account_number=?,bank_branch=?,bank_swift=?,updated_by=?,updated_at=datetime('now') WHERE id=1`).bind(...values,user.id),
      env.DB.prepare("INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id) VALUES (?,?,'payment_settings_updated','payment_settings','primary')").bind(crypto.randomUUID(),user.id)
    ]);
    const settings = await env.DB.prepare(SELECT).first();
    return json({ message: "Payment destination details updated.", settings, editable: true, realMoneyEnabled: false });
  } catch {
    return json({ error: "Payment settings could not be saved. Please retry." }, 503);
  }
}
