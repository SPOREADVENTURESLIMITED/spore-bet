import { currentUser, json } from "./_auth.js";
export async function onRequestGet({request,env}) {
  if(!env.DB)return json({error:"Database unavailable."},503);
  let user;try{user=await currentUser(request,env.DB);}catch{return json({error:"Session unavailable."},503);}
  if(!user)return json({error:"Authentication required."},401);
  const rows=await env.DB.prepare("SELECT id,amount_minor AS amount,currency,status,payment_method AS method,external_reference AS destination,created_at AS createdAt FROM cash_transactions WHERE user_id=? AND transaction_type='withdrawal' ORDER BY created_at DESC LIMIT 50").bind(user.id).all();
  return json({transactions:rows.results||[]});
}
export async function onRequestPost({request,env}) {
  if(!env.DB)return json({error:"Database unavailable."},503);
  let user;try{user=await currentUser(request,env.DB);}catch{return json({error:"Session unavailable."},503);}
  if(!user)return json({error:"Authentication required."},401);
  if(!request.headers.get("Content-Type")?.toLowerCase().includes("application/json"))return json({error:"JSON required."},415);
  let b;try{b=await request.json();}catch{return json({error:"Invalid JSON."},400);}
  const amount=b.amountMinor,method=b.method,key=b.idempotencyKey,destination=typeof b.destination==="string"?b.destination.trim().slice(0,120):"";
  if(!Number.isSafeInteger(amount)||amount<100||amount>1000000000)return json({error:"Amount must be 100 to 1,000,000,000 minor units."},400);
  if(!["airtel_money","mtn_momo","bank"].includes(method)||!destination||typeof key!=="string"||!/^[0-9a-f-]{36}$/i.test(key))return json({error:"Valid method, destination and idempotency key required."},400);
  try{
    const prior=await env.DB.prepare("SELECT id,status,amount_minor AS amount FROM cash_transactions WHERE user_id=? AND transaction_type='withdrawal' AND idempotency_key=?").bind(user.id,key).first();
    if(prior)return json({transaction:prior,replayed:true});
    const wallet=await env.DB.prepare("SELECT id,currency FROM wallets WHERE user_id=? AND wallet_type='cash' AND currency='UGX' AND status='active'").bind(user.id).first();
    if(!wallet)return json({error:"Cash wallet has no available funds."},409);
    const id=crypto.randomUUID();
    const result=await env.DB.batch([
      env.DB.prepare("UPDATE wallets SET balance_minor=balance_minor-? WHERE id=? AND user_id=? AND wallet_type='cash' AND status='active' AND balance_minor>=?").bind(amount,wallet.id,user.id,amount),
      env.DB.prepare("INSERT INTO cash_transactions(id,user_id,wallet_id,transaction_type,amount_minor,currency,status,payment_method,external_reference,idempotency_key) SELECT ?,?,?, 'withdrawal',?,?,'pending',?,?,? WHERE changes()=1").bind(id,user.id,wallet.id,amount,wallet.currency,method,destination,key),
      env.DB.prepare("INSERT INTO wallet_ledger(id,wallet_id,entry_type,amount_minor,direction,reference,description) SELECT ?,?,'withdrawal_reserve',?,'debit',?,'Withdrawal amount reserved' WHERE EXISTS(SELECT 1 FROM cash_transactions WHERE id=?)").bind(crypto.randomUUID(),wallet.id,amount,"withdrawal:"+id,id),
      env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) SELECT ?,?,'cash_withdrawal_requested','cash_transaction',?,? WHERE EXISTS(SELECT 1 FROM cash_transactions WHERE id=?)").bind(crypto.randomUUID(),user.id,id,JSON.stringify({amount,method}),id)
    ]);
    if(result[0]?.meta?.changes!==1||result[1]?.meta?.changes!==1)return json({error:"Insufficient available cash balance or request conflict."},409);
    return json({message:"Withdrawal request recorded; funds are reserved pending administrator processing.",transaction:{id,status:"pending",amount,method,currency:wallet.currency}},201);
  }catch{return json({error:"Withdrawal request could not be recorded."},503);}
}