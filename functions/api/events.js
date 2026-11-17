export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return Response.json(
      { events: [], mode: "demo-only", databaseConfigured: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  let realMoneyEnabled = false;
  try { const mode = await env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key='real_money_enabled'").first(); realMoneyEnabled = mode?.setting_value === "true"; } catch {}
  const url = new URL(request.url);
  const sportId = url.searchParams.get("sport");
  const limitValue = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isInteger(limitValue)
    ? Math.min(Math.max(limitValue, 1), 100)
    : 50;

  try {
    const query = sportId
      ? env.DB.prepare(
          `SELECT e.id, s.name AS sport, e.competition, e.home_name AS home,
                  e.away_name AS away, e.starts_at AS startsAt, e.status
           FROM events e JOIN sports s ON s.id = e.sport_id
           WHERE e.sport_id = ? AND e.status IN ('scheduled','live')
           ORDER BY e.starts_at LIMIT ?`
        ).bind(sportId, limit)
      : env.DB.prepare(
          `SELECT e.id, s.name AS sport, e.competition, e.home_name AS home,
                  e.away_name AS away, e.starts_at AS startsAt, e.status
           FROM events e JOIN sports s ON s.id = e.sport_id
           WHERE e.status IN ('scheduled','live')
           ORDER BY e.starts_at LIMIT ?`
        ).bind(limit);

    const result = await query.all();
    return Response.json(
      { events: result.results || [], mode: realMoneyEnabled ? "cash-and-demo" : "demo-only", realMoneyEnabled, databaseConfigured: true },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
    );
  } catch {
    return Response.json(
      { error: "Events are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
