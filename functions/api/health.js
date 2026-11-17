export async function onRequestGet({ env }) {
  const databaseConfigured = Boolean(env.DB);
  let databaseConnected = false;
  let realMoneyEnabled = false;
  if (databaseConfigured) {
    try {
      const [db, mode] = await Promise.all([
        env.DB.prepare("SELECT 1 AS ok").first(),
        env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key='real_money_enabled'").first()
      ]);
      databaseConnected = Number(db?.ok) === 1;
      realMoneyEnabled = mode?.setting_value === "true";
    } catch { databaseConnected = false; }
  }
  const healthy = databaseConfigured && databaseConnected;
  return Response.json({
    service: "SPORE BET API",
    status: healthy ? "ok" : "degraded",
    mode: realMoneyEnabled ? "cash-and-demo" : "demo-only",
    realMoneyEnabled,
    footballProviderConfigured: Boolean(env.SPORTMONKS_API_TOKEN),
    databaseConfigured,
    databaseConnected,
    timestamp: new Date().toISOString()
  }, { status: healthy ? 200 : 503, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"
  }});
}