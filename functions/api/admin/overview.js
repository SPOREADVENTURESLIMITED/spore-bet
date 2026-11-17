import { currentUser, json } from "../_auth.js";
export async function onRequestGet({request,env}) {
  if(!env.DB)return json({error:"Database is not configured."},503);
  try {
    const user=await currentUser(request,env.DB);
    if(!user)return json({error:"Authentication required."},401);
    if(user.role!=="admin")return json({error:"Administrator access required."},403);
    if(!user.adminMfaVerified)return json({error:user.totpEnabled?"Complete administrator MFA to continue.":"Administrator MFA enrollment is required.",code:user.totpEnabled?"MFA_REQUIRED":"MFA_SETUP_REQUIRED"},403);
    const [users,active,bets,demoCredits,cashBalance,recent,mode]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE status='active'").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM bets").first(),
      env.DB.prepare("SELECT COALESCE(SUM(balance_minor),0) AS total FROM wallets WHERE wallet_type='demo'").first(),
      env.DB.prepare("SELECT COALESCE(SUM(balance_minor),0) AS total FROM wallets WHERE wallet_type='cash'").first(),
      env.DB.prepare("SELECT id,action,entity_type,entity_id,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20").all(),
      env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key='real_money_enabled'").first()
    ]);
    const realMoneyEnabled=mode?.setting_value==="true";
    return json({summary:{registeredUsers:users?.count||0,activeUsers:active?.count||0,recordedBets:bets?.count||0,demoCreditsOutstanding:demoCredits?.total||0,cashWalletBalances:cashBalance?.total||0},recentActivity:recent?.results||[],mode:realMoneyEnabled?"cash-and-demo":"demo-only",realMoneyEnabled,footballProviderConfigured:Boolean(env.SPORTMONKS_API_TOKEN)});
  } catch { return json({error:"Administrator data is temporarily unavailable."},503); }
}