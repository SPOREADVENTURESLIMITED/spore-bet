import { currentUser, json } from "../_auth.js";
export async function onRequestGet({request,env}) {
  if(!env.DB)return json({error:"Database is not configured."},503);
  try {
    const user=await currentUser(request,env.DB);
    if(!user)return json({error:"Authentication required."},401);
    if(user.role!=="admin")return json({error:"Administrator access required."},403);
    if(!user.adminMfaVerified)return json({error:user.totpEnabled?"Complete administrator MFA to continue.":"Administrator MFA enrollment is required.",code:user.totpEnabled?"MFA_REQUIRED":"MFA_SETUP_REQUIRED"},403);
    const [users,active,bets,recent]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE status='active'").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM bets").first(),
      env.DB.prepare("SELECT id,action,entity_type,entity_id,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20").all()
    ]);
    return json({
      summary:{registeredUsers:users?.count||0,activeUsers:active?.count||0,legacyBetRecords:bets?.count||0},
      recentActivity:recent?.results||[],
      mode:"real-money-not-launched",
      realMoneyEnabled:false,
      wageringAvailable:false,
      depositsAvailable:false,
      withdrawalsAvailable:false,
      footballProviderConfigured:Boolean(env.SPORTMONKS_API_TOKEN)
    });
  } catch { return json({error:"Administrator data is temporarily unavailable."},503); }
}
