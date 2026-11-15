import { currentUser, json } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  try {
    const user = await currentUser(request, env.DB);
    if (!user) return json({ error: "Authentication required." }, 401);
    if (user.role !== "admin") return json({ error: "Administrator access required." }, 403);

    const [users, active, bets, demoCredits, recent] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'active'").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM bets").first(),
      env.DB.prepare("SELECT COALESCE(SUM(balance_minor),0) AS total FROM wallets WHERE wallet_type = 'demo'").first(),
      env.DB.prepare("SELECT id, action, entity_type, entity_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20").all()
    ]);
    return json({
      summary: {
        registeredUsers: users?.count || 0,
        activeUsers: active?.count || 0,
        recordedBets: bets?.count || 0,
        demoCreditsOutstanding: demoCredits?.total || 0
      },
      recentActivity: recent?.results || [],
      mode: "demo-only",
      realMoneyEnabled: false
    });
  } catch {
    return json({ error: "Administrator data is temporarily unavailable." }, 503);
  }
}
