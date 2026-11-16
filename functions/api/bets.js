import { currentUser, json } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  const user = await currentUser(request, env.DB);
  if (!user) return json({ error: "Authentication required." }, 401);
  try {
    const rows = await env.DB.prepare(
      `SELECT b.id, b.stake_minor AS stake, b.combined_odds AS combinedOdds,
              b.potential_return_minor AS potentialReturn, b.status, b.created_at AS createdAt
       FROM bets b WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 50`
    ).bind(user.id).all();
    return json({ bets: rows.results || [], mode: "demo-only" });
  } catch {
    return json({ error: "Bet history is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured." }, 503);
  const user = await currentUser(request, env.DB);
  if (!user) return json({ error: "Authentication required." }, 401);
  if (user.role === "admin" && !user.adminMfaVerified) return json({ error: "Complete administrator MFA before placing bets." }, 403);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "Send bet details as JSON." }, 415);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const stake = body.stake;
  const ids = Array.isArray(body.selectionIds) ? [...new Set(body.selectionIds)] : [];
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!Number.isSafeInteger(stake) || stake < 1 || stake > 1000000000) return json({ error: "Stake must be a whole number between 1 and 1,000,000,000 demo credits." }, 400);
  if (ids.length < 1 || ids.length > 10 || ids.some(id => typeof id !== "string" || id.length > 128)) return json({ error: "Choose 1–10 valid selections." }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(key)) return json({ error: "A valid idempotency key is required." }, 400);

  try {
    const prior = await env.DB.prepare("SELECT id, stake_minor AS stake, status FROM bets WHERE user_id = ? AND idempotency_key = ?").bind(user.id, key).first();
    if (prior) return json({ message: "This bet was already recorded.", bet: prior, replayed: true });

    const marks = ids.map(() => "?").join(",");
    const selected = await env.DB.prepare(
      `SELECT s.id, s.odds_decimal AS odds, s.status AS selectionStatus,
              m.status AS marketStatus, e.status AS eventStatus, e.starts_at AS startsAt
       FROM selections s JOIN markets m ON m.id=s.market_id JOIN events e ON e.id=m.event_id
       WHERE s.id IN (${marks})`
    ).bind(...ids).all();
    const rows = selected.results || [];
    if (rows.length !== ids.length || rows.some(x => x.selectionStatus !== "open" || x.marketStatus !== "open" || x.eventStatus !== "scheduled" || !(Date.parse(x.startsAt) > Date.now()))) {
      return json({ error: "One or more selections are unavailable or have started." }, 409);
    }
    const combinedOdds = rows.reduce((total, row) => total * Number(row.odds), 1);
    if (!Number.isFinite(combinedOdds) || combinedOdds <= 1 || combinedOdds > 100000) return json({ error: "Combined odds are outside the supported range." }, 400);
    const potentialReturn = Math.floor(stake * combinedOdds);
    if (!Number.isSafeInteger(potentialReturn)) return json({ error: "Potential return exceeds the supported limit." }, 400);

    const betId = crypto.randomUUID();
    const walletId = user.walletId;
    const expectedOdds = rows.map(row => "(s.id = ? AND s.odds_decimal = ?)").join(" OR ");
    const updateBindings = [stake, walletId, user.id, stake, ...rows.flatMap(row => [row.id, row.odds])];
    const statements = [
      env.DB.prepare(
        `UPDATE wallets SET balance_minor = balance_minor - ?
         WHERE id = ? AND user_id = ? AND wallet_type = 'demo' AND status = 'active'
           AND balance_minor >= ?
           AND (SELECT COUNT(*) FROM selections s JOIN markets m ON m.id=s.market_id
                JOIN events e ON e.id=m.event_id
                WHERE (${expectedOdds}) AND s.status='open' AND m.status='open'
                  AND e.status='scheduled' AND e.starts_at > datetime('now')) = ?`
      ).bind(...updateBindings, ids.length),
      env.DB.prepare(
        `INSERT INTO bets (id,user_id,wallet_id,bet_type,stake_minor,combined_odds,potential_return_minor,status,idempotency_key)
         SELECT ?,?,?,?, ?,?,?, 'pending', ? WHERE changes() = 1`
      ).bind(betId,user.id,walletId,ids.length > 1 ? "multiple" : "single",stake,combinedOdds,potentialReturn,key),
      env.DB.prepare(
        `INSERT INTO bet_legs (id,bet_id,selection_id,odds_at_placement)
         SELECT lower(hex(randomblob(16))), ?, s.id, s.odds_decimal FROM selections s
         WHERE s.id IN (${marks}) AND EXISTS (SELECT 1 FROM bets WHERE id = ?)`
      ).bind(betId,...ids,betId),
      env.DB.prepare(
        `INSERT INTO wallet_ledger (id,wallet_id,entry_type,amount_minor,direction,reference,description)
         SELECT lower(hex(randomblob(16))), ?, 'bet_stake', ?, 'debit', ?, 'Demo bet stake'
         WHERE EXISTS (SELECT 1 FROM bets WHERE id = ?)`
      ).bind(walletId,stake,`bet:${betId}`,betId),
      env.DB.prepare(
        `INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,metadata_json)
         SELECT lower(hex(randomblob(16))), ?, 'demo_bet_placed', 'bet', ?, ?
         WHERE EXISTS (SELECT 1 FROM bets WHERE id = ?)`
      ).bind(user.id,betId,JSON.stringify({stake,selectionCount:ids.length}),betId)
    ];
    const result = await env.DB.batch(statements);
    if (result[0]?.meta?.changes !== 1 || result[1]?.meta?.changes !== 1) {
      return json({ error: "Bet could not be placed. Check your demo balance and selection availability." }, 409);
    }
    const wallet = await env.DB.prepare("SELECT balance_minor FROM wallets WHERE id = ?").bind(walletId).first();
    return json({ message: "Demo bet recorded.", bet: { id: betId, stake, combinedOdds, potentialReturn, status: "pending" }, wallet: { balance: wallet?.balance_minor ?? 0, currency: user.currency || "DCR" }, mode: "demo-only" }, 201);
  } catch (error) {
    const prior = await env.DB.prepare("SELECT id, stake_minor AS stake, status FROM bets WHERE user_id = ? AND idempotency_key = ?").bind(user.id, key).first().catch(() => null);
    if (prior) return json({ message: "This bet was already recorded.", bet: prior, replayed: true });
    return json({ error: "Bet placement is temporarily unavailable." }, 503);
  }
}
