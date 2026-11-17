import test from "node:test";
import assert from "node:assert/strict";
import { currentUser, createSession } from "../functions/api/_auth.js";
import { onRequestPost as revokeAllAdminSessions } from "../functions/api/admin/sessions/revoke-all.js";

function fakeDb({ firstResult = null } = {}) {
  const statements = [];
  const batches = [];
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        params: [],
        bind(...params) { this.params = params; return this; },
        async first() { return firstResult; },
        async run() { return { meta: { changes: 1 } }; }
      };
      statements.push(statement);
      return statement;
    },
    async batch(items) {
      batches.push(items);
      return [{ meta: { changes: 2 } }, {}];
    }
  };
  return { db, statements, batches };
}

test("anonymous requests do not query the session store", async () => {
  const { db, statements } = fakeDb();
  const user = await currentUser(new Request("https://example.test/"), db);
  assert.equal(user, null);
  assert.equal(statements.length, 0);
});

test("session lookup enforces 30-minute idle expiry", async () => {
  const { db, statements } = fakeDb();
  const request = new Request("https://example.test/", { headers: { Cookie: "spore_session=opaque-test-token" } });
  const user = await currentUser(request, db);
  assert.equal(user, null);
  assert.match(statements[0].sql, /last_seen_at>datetime\('now','-30 minutes'\)/);
  assert.equal(statements.length, 1, "invalid/idle sessions must not be refreshed");
});

test("valid sessions refresh last activity after lookup", async () => {
  const { db, statements } = fakeDb({ firstResult: { id: "test-user", role: "admin" } });
  const request = new Request("https://example.test/", { headers: { Cookie: "spore_session=opaque-test-token" } });
  const user = await currentUser(request, db);
  assert.equal(user.id, "test-user");
  assert.equal(statements.length, 2);
  assert.match(statements[1].sql, /UPDATE sessions SET last_seen_at=datetime\('now'\)/);
});

test("new sessions initialize the idle activity timestamp", async () => {
  const { db, statements } = fakeDb();
  await createSession(db, "test-user");
  assert.match(statements[0].sql, /expires_at,last_seen_at/);
  assert.match(statements[0].sql, /datetime\('now'\)/);
});

function adminPostRequest() {
  return new Request("https://example.test/api/admin/sessions/revoke-all", {
    method: "POST",
    headers: { Cookie: "spore_session=opaque-test-token", "Content-Type": "application/json" },
    body: "{}"
  });
}

test("administrator-wide revocation rejects customer accounts", async () => {
  const { db, batches } = fakeDb({ firstResult: { id: "customer-1", role: "customer", adminMfaVerified: 0 } });
  const response = await revokeAllAdminSessions({ request: adminPostRequest(), env: { DB: db } });
  assert.equal(response.status, 403);
  assert.equal(batches.length, 0);
});

test("administrator-wide revocation atomically revokes admins and records audit event", async () => {
  const { db, batches } = fakeDb({ firstResult: { id: "admin-1", role: "admin", adminMfaVerified: 1 } });
  const response = await revokeAllAdminSessions({ request: adminPostRequest(), env: { DB: db } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.revokedSessions, 2);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.match(batches[0][0].sql, /user_id IN \(SELECT id FROM users WHERE role='admin'\)/);
  assert.match(batches[0][1].sql, /admin_sessions_revoked/);
});

test("session lookup also enforces absolute expiry and revoked status", async () => {
  const { db, statements } = fakeDb();
  const request = new Request("https://example.test/", { headers: { Cookie: "spore_session=opaque-test-token" } });
  await currentUser(request, db);
  assert.ok(statements[0].sql.includes("s.expires_at>datetime('now')"));
  assert.ok(statements[0].sql.includes("s.revoked_at IS NULL"));
});

test("administrator-wide revocation rejects an administrator without verified MFA", async () => {
  const { db, batches } = fakeDb({ firstResult: { id: "admin-1", role: "admin", adminMfaVerified: 0 } });
  const response = await revokeAllAdminSessions({ request: adminPostRequest(), env: { DB: db } });
  assert.equal(response.status, 403);
  assert.equal(batches.length, 0);
});
