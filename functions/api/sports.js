export async function onRequestGet() {
  return Response.json(
    { sports: [], source: null, wageringAvailable: false, message: "Approved live sports-data integration is pending." },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
