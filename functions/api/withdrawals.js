import { currentUser, json } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database unavailable." }, 503);
  let user; try { user = await currentUser(request, env.DB); } catch { return json({ error: "Session unavailable." }, 503); }
  if (!user) return json({ error: "Authentication required." }, 401);
  return json({ transactions: [], withdrawalsAvailable: false });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database unavailable." }, 503);
  let user; try { user = await currentUser(request, env.DB); } catch { return json({ error: "Session unavailable." }, 503); }
  if (!user) return json({ error: "Authentication required." }, 401);
  return json({ error: "Withdrawals are disabled until verified payout providers, cash ledger controls and dual-approval operations are live.", code: "WITHDRAWALS_NOT_LAUNCHED" }, 423);
}
