import { currentUser, json } from "../_auth.js";
export async function onRequestGet({request,env}) {
 if(!env.DB)return json({error:"Database unavailable."},503);
 let user;try{user=await currentUser(request,env.DB);}catch{return json({error:"Session unavailable."},503);}
 if(!user)return json({error:"Authentication required."},401);
 if(user.role!=="admin")return json({error:"Administrator access required."},403);
 if(!user.adminMfaVerified)return json({error:"Administrator MFA required.",code:"MFA_REQUIRED"},403);
 const rows=await env.DB.prepare("SELECT t.id,t.user_id AS userId,u.email,t.transaction_type AS type,t.amount_minor AS amount,t.currency,t.status,t.payment_method AS method,t.external_reference AS reference,t.created_at AS createdAt FROM cash_transactions t JOIN users u ON u.id=t.user_id ORDER BY CASE WHEN t.status='pending' THEN 0 ELSE 1 END,t.created_at DESC LIMIT 200").all();
 return json({transactions:rows.results||[]});
}
export async function onRequestPost({request,env}) {
 if(!env.DB)return json({error:"Database unavailable."},503);
 let admin;try{admin=await currentUser(request,env.DB);}catch{return json({error:"Session unavailable."},503);}
 if(!admin)return json({error:"Authentication required."},401);
 if(admin.role!=="admin")return json({error:"Administrator access required."},403);
 if(!admin.adminMfaVerified)return json({error:"Administrator MFA required.",code:"MFA_REQUIRED"},403);
 if(!request.headers.get("Content-Type")?.toLowerCase().includes("application/json"))return json({error:"JSON required."},415);
 let b;try{b=await request.json();}catch{return json({error:"Invalid JSON."},400);}
 const {transactionId,decision,note}=b;
 if(typeof transactionId!=="string"||!["approve","reject","paid"].includes(decision))return json({error:"Valid transactionId and decision required."},400);
 try{
  const tx=await env.DB.prepare("SELECT * FROM cash_transactions WHERE id=? AND status='pending'").bind(transactionId).first();
  if(!tx)return json({error:"Pending transaction not found."},404);
  if(tx.transaction_type==="deposit"&&decision==="paid")return json({error:"Deposits must be approved after receipt verification."},400);
  if(tx.transaction_type==="withdrawal"&&decision==="approve")return json({error:"Use paid after the payout has actually been sent, or reject to release the reserve."},400);
  if(tx.transaction_type==="deposit"&&decision==="reject"||tx.transaction_type==="withdrawal"&&decision==="reject"){
    const refund=tx.transaction_type==="withdrawal";
    const stmts=[
     env.DB.prepare("UPDATE cash_transactions SET status='rejected',admin_note=?,reviewed_by=?,reviewed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='pending'").bind(typeof note==="string"?note.slice(0,500):null,admin.id,tx.id),
     ...(refund?[env.DB.prepare("UPDATE wallets SET balance_minor=balance_minor+? WHERE id=? AND changes()=1").bind(tx.amount_minor,tx.wallet_id,tx.id),
     env.DB.prepare("INSERT INTO wallet_ledger(id,wallet_id,entry_type,amount_minor,direction,reference,description) SELECT ?,?,'withdrawal_release',?,'credit',?,'Rejected withdrawal reserve released' WHERE changes()=1").bind(crypto.randomUUID(),tx.wallet_id,tx.amount_minor,"withdrawal-release:"+tx.id)]:[]),
     env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,'cash_transaction_rejected','cash_transaction',?,?)").bind(crypto.randomUUID(),admin.id,tx.id,JSON.stringify({type:tx.transaction_type,amount:tx.amount_minor}))
    ];
    await env.DB.batch(stmts);
    return json({message:"Transaction rejected.",id:tx.id,status:"rejected"});
  }
  if(tx.transaction_type==="deposit"&&decision==="approve"){
   await env.DB.batch([
    env.DB.prepare("UPDATE cash_transactions SET status='approved',admin_note=?,reviewed_by=?,reviewed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='pending'").bind(typeof note==="string"?note.slice(0,500):null,admin.id,tx.id),
    env.DB.prepare("UPDATE wallets SET balance_minor=balance_minor+? WHERE id=? AND changes()=1").bind(tx.amount_minor,tx.wallet_id,tx.id),
    env.DB.prepare("INSERT INTO wallet_ledger(id,wallet_id,entry_type,amount_minor,direction,reference,description) SELECT ?,?,'deposit',?,'credit',?,'Administrator-approved deposit' WHERE changes()=1").bind(crypto.randomUUID(),tx.wallet_id,tx.amount_minor,"deposit:"+tx.id),
    env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,'cash_deposit_approved','cash_transaction',?,?)").bind(crypto.randomUUID(),admin.id,tx.id,JSON.stringify({amount:tx.amount_minor}))
   ]);
   return json({message:"Deposit approved and cash wallet credited.",id:tx.id,status:"approved"});
  }
  if(tx.transaction_type==="withdrawal"&&decision==="paid"){
   const result=await env.DB.prepare("UPDATE cash_transactions SET status='paid',admin_note=?,reviewed_by=?,reviewed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='pending'").bind(typeof note==="string"?note.slice(0,500):null,admin.id,tx.id).run();
   if(result.meta?.changes!==1)return json({error:"Transaction state changed; refresh and retry."},409);
   await env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,'cash_withdrawal_paid','cash_transaction',?,?)").bind(crypto.randomUUID(),admin.id,tx.id,JSON.stringify({amount:tx.amount_minor})).run();
   return json({message:"Withdrawal marked paid. The reserved amount was already debited.",id:tx.id,status:"paid"});
  }
  return json({error:"Unsupported transaction decision."},400);
 }catch{return json({error:"Transaction review failed; refresh and verify its status."},503);}
}