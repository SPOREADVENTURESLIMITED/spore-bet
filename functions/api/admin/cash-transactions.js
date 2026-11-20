import { currentUser, json } from "../_auth.js";

async function requireAdmin(request, env) {
  if (!env.DB) return { error: json({ error: "Database unavailable." }, 503) };
  let user; try { user = await currentUser(request, env.DB); } catch { return { error: json({ error: "Session unavailable." }, 503) }; }
  if (!user) return { error: json({ error: "Authentication required." }, 401) };
  if (user.role !== "admin") return { error: json({ error: "Administrator access required." }, 403) };
  if (!user.adminMfaVerified) return { error: json({ error: "Administrator MFA required.", code: "MFA_REQUIRED" }, 403) };
  return { user };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  return json({ transactions: [], cashOperationsAvailable: false, message: "Manual cash transaction processing is disabled pending the double-entry ledger and provider verification release." });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  return json({ error: "Manual cash credits, approvals and payouts are disabled. No administrator action can bypass provider verification, maker-checker controls or the cash ledger release gate.", code: "CASH_OPERATIONS_NOT_LAUNCHED" }, 423);
}
