// Read-only market catalogue. This endpoint never accepts or places wagers.
export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return Response.json(
      { markets: [], mode: "demo-only", databaseConfigured: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  let realMoneyEnabled = false;
  try { const mode = await env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key='real_money_enabled'").first(); realMoneyEnabled = mode?.setting_value === "true"; } catch {}
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event");
  if (!eventId || eventId.length > 128) {
    return Response.json(
      { error: "A valid event query parameter is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT m.id AS marketId, m.name AS market, m.status AS marketStatus,
              s.id AS selectionId, s.name AS selection,
              s.odds_decimal AS odds, s.status AS selectionStatus
       FROM markets m
       LEFT JOIN selections s ON s.market_id = m.id
       WHERE m.event_id = ?
       ORDER BY m.name, s.name`
    ).bind(eventId).all();

    return Response.json(
      { markets: result.results || [], mode: realMoneyEnabled ? "cash-and-demo" : "demo-only", realMoneyEnabled },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
    );
  } catch {
    return Response.json(
      { error: "Markets are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
