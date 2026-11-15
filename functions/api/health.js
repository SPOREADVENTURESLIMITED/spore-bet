export async function onRequestGet({ env }) {
  const databaseConfigured = Boolean(env.DB);
  return Response.json({
    service: "SPORE BET API",
    status: "ok",
    mode: "demo-only",
    realMoneyEnabled: false,
    databaseConfigured,
    timestamp: new Date().toISOString()
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
