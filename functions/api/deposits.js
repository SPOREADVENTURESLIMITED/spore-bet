import { currentUser, json } from "./_auth.js";
export async function onRequestGet({request,env}) {
  if(!env.DB)return json({error:"Database unavailable."},503);
  let user; try{user=await currentUser(request,env.DB);}catch{return json({error:"Session unavailable."},503);}
  if(!user)return json({error:"Authentication required."},401);
  const rows=await env.DB.prepare("SELECT id,transaction_type AS type,amount_minor AS amount,currency,status,payment_method AS method,external_reference AS reference,created_at AS createdAt FROM cash_transactions WHERE user_id=? AND transaction_type='deposit' ORDER BY created_at DESC LIMIT 50").bind(user.id).all();
  return json({transactions:rows.results||[]});
}
export async function onRequestPost({request,env}) {
  if(!env.DB)return json({error:"Database unavailable."},503);
  let user; try{user=await currentUser(request,env.DB);}catch{return json({error:"Session unavailable."},503);}
  if(!user)return json({error:"Authentication required."},401);
  if(!request.headers.get("Content-Type")?.toLowerCase().includes("application/json"))return json({error:"JSON required."},415);
  let b;try{b=await request.json();}catch{return json({error:"Invalid JSON."},400);}
  const amount=b.amountMinor,method=b.method,key=b.idempotencyKey,reference=typeof b.reference==="string"?b.reference.trim().slice(0,120):null;
  if(!Number.isSafeInteger(amount)||amount<100||amount>1000000000)return json({error:"Amount must be 100 to 1,000,000,000 minor units."},400);
  if(!["airtel_money","mtn_momo","bank"].includes(method)||typeof key!=="string"||!/^[0-9a-f-]{36}$/i.test(key))return json({error:"Valid payment method and idempotency key required."},400);
  try{
    let wallet=await env.DB.prepare("SELECT id,currency FROM wallets WHERE user_id=? AND wallet_type='cash' AND currency='UGX'").bind(user.id).first();
    if(!wallet){const id=crypto.randomUUID();await env.DB.prepare("INSERT OR IGNORE INTO wallets(id,user_id,wallet_type,currency,balance_minor) VALUES(?,?,'cash','UGX',0)").bind(id,user.id).run();wallet=await env.DB.prepare("SELECT id,currency FROM wallets WHERE user_id=? AND wallet_type='cash' AND currency='UGX'").bind(user.id).first();}
    const prior=await env.DB.prepare("SELECT id,status,amount_minor AS amount FROM cash_transactions WHERE user_id=? AND transaction_type='deposit' AND idempotency_key=?").bind(user.id,key).first();
    if(prior)return json({transaction:prior,replayed:true});
    const id=crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO cash_transactions(id,user_id,wallet_id,transaction_type,amount_minor,currency,status,payment_method,external_reference,idempotency_key) VALUES(?,?,?,'deposit',?,?,'pending',?,?,?)").bind(id,user.id,wallet.id,amount,wallet.currency,method,reference,key),
      env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,'cash_deposit_requested','cash_transaction',?,?)").bind(crypto.randomUUID(),user.id,id,JSON.stringify({amount,method}))
    ]);
    return json({message:"Deposit request recorded; funds are not credited until verified and approved.",transaction:{id,status:"pending",amount,method,currency:wallet.currency}},201);
  }catch{return json({error:"Deposit request could not be recorded."},503);}
}