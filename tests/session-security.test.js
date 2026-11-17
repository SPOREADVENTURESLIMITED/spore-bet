import test from "node:test";
import assert from "node:assert/strict";
import { currentUser, createSession } from "../functions/api/_auth.js";

function fakeDb({ firstResult = null } = {}) {
  const statements = [];
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
    }
  };
  return { db, statements };
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
