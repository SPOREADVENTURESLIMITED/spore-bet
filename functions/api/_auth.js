const ITERATIONS = 100000;
const SESSION_DAYS = 7;

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return null;
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("Invalid hash");
  return new Uint8Array(value.match(/.{2}/g).map((x) => parseInt(x, 16)));
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, roundsText, saltHex, expectedHex] = stored.split("$");
    const rounds = Number(roundsText);
    if (scheme !== "pbkdf2-sha256" || !Number.isInteger(rounds) || rounds < 10000 || rounds > 1000000) return false;
    const salt = fromHex(saltHex);
    const expected = fromHex(expectedHex);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, key, expected.length * 8));
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export async function sha256(value) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function createSession(db, userId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(tokenBytes);
  const tokenHash = await sha256(token);
  const sessionId = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))"
  ).bind(sessionId, userId, tokenHash).run();
  return token;
}

export function sessionCookie(token) {
  return `spore_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearSessionCookie = "spore_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

export async function currentUser(request, db) {
  const token = readCookie(request, "spore_session");
  if (!token || token.length > 128) return null;
  const tokenHash = await sha256(token);
  const row = await db.prepare(
    `SELECT u.id, u.email, u.phone, u.display_name AS displayName, u.role, u.status,
            w.id AS walletId, w.balance_minor AS balanceMinor, w.currency
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN wallets w ON w.user_id = u.id AND w.wallet_type = 'demo'
     WHERE s.token_hash = ? AND s.revoked_at IS NULL
       AND s.expires_at > datetime('now') AND u.status = 'active'
     LIMIT 1`
  ).bind(tokenHash).first();
  return row || null;
}
