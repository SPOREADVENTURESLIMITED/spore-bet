export async function onRequestGet() {
  return Response.json(
    { markets: [], wageringAvailable: false, message: "Verified live markets are not yet available." },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
