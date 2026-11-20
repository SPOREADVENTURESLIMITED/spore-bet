export async function onRequestGet() {
  return Response.json(
    { events: [], source: null, wageringAvailable: false, message: "Approved live sports feeds are not yet connected." },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
