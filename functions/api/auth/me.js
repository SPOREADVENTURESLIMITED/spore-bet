import { currentUser, json } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  try {
    const user = await currentUser(request, env.DB);
    if (!user) return json({ error: "Authentication required." }, 401);
    return json({
      user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName, role: user.role },
      wallet: { type: "demo", currency: user.currency || "DCR", balance: user.balanceMinor || 0 },
      mode: "demo-only",
      realMoneyEnabled: false
    });
  } catch {
    return json({ error: "Account information is temporarily unavailable." }, 503);
  }
}
