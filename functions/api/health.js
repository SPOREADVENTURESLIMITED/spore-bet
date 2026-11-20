export async function onRequestGet({ env }) {
  const databaseConfigured = Boolean(env.DB);
  let databaseConnected = false;
  if (databaseConfigured) {
    try {
      const db = await env.DB.prepare("SELECT 1 AS ok").first();
      databaseConnected = Number(db?.ok) === 1;
    } catch { databaseConnected = false; }
  }
  const healthy = databaseConfigured && databaseConnected;
  return Response.json({
    service: "SPORE BET API",
    status: healthy ? "ok" : "degraded",
    mode: "real-money-not-launched",
    realMoneyEnabled: false,
    wageringAvailable: false,
    depositsAvailable: false,
    withdrawalsAvailable: false,
    footballProviderConfigured: Boolean(env.SPORTMONKS_API_TOKEN),
    databaseConfigured,
    databaseConnected,
    timestamp: new Date().toISOString()
  }, { status: healthy ? 200 : 503, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"
  }});
}
