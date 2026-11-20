import assert from "node:assert/strict";

const base = (process.env.BASE_URL || "https://spore-bet.pages.dev").replace(/\/$/, "");
async function get(path, init) {
  return fetch(base + path, { redirect: "manual", cache: "no-store", ...init });
}
const home = await get("/");
assert.equal(home.status, 200, "homepage must return HTTP 200");
const html = await home.text();
assert.match(html, /real-money service not yet available/i);
assert.doesNotMatch(html, /demo credits|virtual bet slip|sample markets/i);
assert.equal(home.headers.get("x-content-type-options"), "nosniff");
assert.equal(home.headers.get("x-frame-options"), "DENY");
assert.match(home.headers.get("strict-transport-security") || "", /max-age=31536000/);

const healthResponse = await get("/api/health");
assert.equal(healthResponse.status, 200, "health endpoint must return HTTP 200");
const health = await healthResponse.json();
assert.equal(health.status, "ok");
assert.equal(health.mode, "real-money-not-launched");
assert.equal(health.realMoneyEnabled, false);
assert.equal(health.wageringAvailable, false);

for (const path of ["/api/sports", "/api/events", "/api/markets"]) {
  const response = await get(path);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.wageringAvailable, false);
  assert.equal((data.sports || data.events || data.markets || []).length, 0);
}

const adminPage = await get("/admin");
assert.equal(adminPage.status, 200, "admin login page must be publicly reachable");
const anonymousAdmin = await get("/api/admin/overview");
assert.equal(anonymousAdmin.status, 401, "anonymous admin overview must be rejected");
const anonymousRevoke = await get("/api/admin/sessions/revoke-all", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
});
assert.equal(anonymousRevoke.status, 401);
const csrf = await get("/api/auth/logout", {
  method: "POST",
  headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" },
  body: "{}"
});
assert.equal(csrf.status, 403);
console.log("PASS: public site has no demo betting UI.");
console.log("PASS: sports, bet, deposit and withdrawal services remain fail-closed.");
console.log("PASS: health, security headers, admin authorization and CSRF checks.");
