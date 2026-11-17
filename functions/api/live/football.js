// Live football data proxy. Keep the provider token in a Cloudflare secret.
const BASE = "https://api.sportmonks.com/v3/football";

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

async function providerGet(path, token) {
  const result = await fetch(`${BASE}${path}`, {
    headers: { Authorization: token, Accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!result.ok) throw new Error(`Football provider returned HTTP ${result.status}`);
  const body = await result.json();
  if (!Array.isArray(body.data)) throw new Error("Football provider returned an unexpected response.");
  return body.data;
}

export async function onRequestGet({ request, env }) {
  const token = env.SPORTMONKS_API_TOKEN;
  if (!token) return response({
    provider: "sportmonks",
    connected: false,
    setupRequired: true,
    message: "The administrator must add SPORTMONKS_API_TOKEN as a Cloudflare secret."
  }, 503);

  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "upcoming" ? "upcoming" : "live";
  try {
    let fixtures;
    if (view === "live") {
      fixtures = await providerGet("/livescores/inplay?include=participants;scores;events;league;state;odds", token);
    } else {
      const from = new Date().toISOString().slice(0, 10);
      const until = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      fixtures = await providerGet(`/fixtures/between/${from}/${until}?include=participants;scores;league;state;odds`, token);
    }
    return response({
      provider: "sportmonks",
      connected: true,
      view,
      fetchedAt: new Date().toISOString(),
      count: fixtures.length,
      fixtures
    });
  } catch {
    return response({
      provider: "sportmonks",
      connected: false,
      message: "Live football data could not be retrieved. Check the provider token, subscription coverage and API availability."
    }, 502);
  }
}
