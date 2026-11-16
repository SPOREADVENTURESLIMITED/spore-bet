import { currentUser,json,readCookie,sha256,decryptTotpSecret,verifyTotp } from "../../_auth.js";
export async function onRequestPost({request,env}) {
  if(!env.DB)return json({error:"Database is not configured."},503);
  let body;try{body=await request.json();}catch{return json({error:"Invalid request body."},400);}
  try {
    const user=await currentUser(request,env.DB);
    if(!user)return json({error:"Authentication required."},401);
    if(user.role!=="admin")return json({error:"Administrator access required."},403);
    if(user.totpEnabled)return json({error:"MFA is already enabled."},409);
    const row=await env.DB.prepare("SELECT totp_secret_encrypted FROM users WHERE id=?").bind(user.id).first();
    if(!row?.totp_secret_encrypted)return json({error:"Start MFA setup first."},400);
    const secret=await decryptTotpSecret(row.totp_secret_encrypted,env);
    if(!(await verifyTotp(secret,String(body.otp||""))))return json({error:"Invalid authenticator code. Try the current six-digit code."},401);
    const token=readCookie(request,"spore_session"),tokenHash=await sha256(token);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET totp_enabled=1,updated_at=datetime('now') WHERE id=? AND role='admin'").bind(user.id),
      env.DB.prepare("UPDATE sessions SET admin_mfa_verified=1 WHERE token_hash=? AND revoked_at IS NULL").bind(tokenHash),
      env.DB.prepare("INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id) VALUES (?,?,'admin_mfa_enabled','user',?)").bind(crypto.randomUUID(),user.id,user.id)
    ]);
    return json({message:"Administrator MFA enabled. This session is now verified."});
  } catch { return json({error:"Could not verify MFA. Check MFA_ENCRYPTION_KEY and try again."},503); }
}
