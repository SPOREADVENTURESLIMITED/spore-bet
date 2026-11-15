const DEFAULT_SPORTS = [
  { id: "football", name: "Football", isActive: true },
  { id: "basketball", name: "Basketball", isActive: true },
  { id: "tennis", name: "Tennis", isActive: true },
  { id: "rugby", name: "Rugby", isActive: true }
];

export async function onRequestGet({ env }) {
  let sports = DEFAULT_SPORTS;
  let source = "fallback";

  if (env.DB) {
    try {
      const result = await env.DB.prepare(
        "SELECT id, name, is_active FROM sports WHERE is_active = 1 ORDER BY name"
      ).all();
      sports = (result.results || []).map((row) => ({
        id: row.id,
        name: row.name,
        isActive: Boolean(row.is_active)
      }));
      source = "d1";
    } catch {
      return Response.json(
        { error: "Sports catalogue is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  return Response.json(
    { sports, mode: "demo-only", realMoneyEnabled: false, source },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
