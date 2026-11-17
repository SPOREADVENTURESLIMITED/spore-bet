import assert from "node:assert/strict";

const base = (process.env.BASE_URL || "https://spore-bet.pages.dev").replace(/\/$/, "");
async function get(path, init) {
  return fetch(base + path, { redirect: "manual", cache: "no-store", ...init });
}

const home = await get("/");
assert.equal(home.status, 200, "homepage must return HTTP 200");
const headers = home.headers;
assert.equal(headers.get("x-content-type-options"), "nosniff");
assert.equal(headers.get("x-frame-options"), "DENY");
assert.match(headers.get("strict-transport-security") || "", /max-age=31536000/);

const adminPage = await get("/admin");
assert.equal(adminPage.status, 200, "admin login page must be publicly reachable");

const healthResponse = await get("/api/health");
assert.equal(healthResponse.status, 200, "health endpoint must return HTTP 200");
const health = await healthResponse.json();
assert.equal(health.status, "ok");
assert.equal(health.mode, "demo-only");
assert.equal(health.realMoneyEnabled, false);

const anonymousAdmin = await get("/api/admin/overview");
assert.equal(anonymousAdmin.status, 401, "anonymous admin overview must be rejected");

const anonymousRevoke = await get("/api/admin/sessions/revoke-all", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}"
});
assert.equal(anonymousRevoke.status, 401, "anonymous administrator revocation must be rejected");

const csrf = await get("/api/auth/logout", {
  method: "POST",
  headers: {
    Origin: "https://attacker.invalid",
    "Sec-Fetch-Site": "cross-site",
    "Content-Type": "application/json"
  },
  body: "{}"
});
assert.equal(csrf.status, 403, "cross-origin state change must be rejected");

console.log("PASS: homepage, admin route and health endpoint.");
console.log("PASS: production remains demo-only.");
console.log("PASS: anonymous admin overview and session revocation are denied.");
console.log("PASS: security headers and cross-origin request protection.");
