import { currentUser, json } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  let user;
  try { user = await currentUser(request, env.DB); }
  catch { return json({ error: "Account session could not be verified." }, 503); }
  if (!user) return json({ error: "Authentication required." }, 401);
  return json({ bets: [], wageringAvailable: false, message: "Customer wagering is not yet available." });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  let user;
  try { user = await currentUser(request, env.DB); }
  catch { return json({ error: "Account session could not be verified." }, 503); }
  if (!user) return json({ error: "Authentication required." }, 401);
  return json({
    error: "Wagering is disabled. Demo betting has been retired; real-money betting will open only after licensing, identity, payment, ledger and security release checks are complete.",
    code: "WAGERING_NOT_LAUNCHED"
  }, 423);
}
