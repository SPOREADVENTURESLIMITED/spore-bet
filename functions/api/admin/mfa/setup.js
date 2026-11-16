import { currentUser,json,readCookie,sha256,base32Encode,encryptTotpSecret } from "../../_auth.js";
export async function onRequestPost({request,env}) {
  if(!env.DB)return json({error:"Database is not configured."},503);
  try {
    const user=await currentUser(request,env.DB);
    if(!user)return json({error:"Authentication required."},401);
    if(user.role!=="admin")return json({error:"Administrator access required."},403);
    if(user.totpEnabled)return json({error:"Administrator MFA is already enabled."},409);
    const random=crypto.getRandomValues(new Uint8Array(20)),secret=base32Encode(random);
    const encrypted=await encryptTotpSecret(secret,env);
    await env.DB.prepare("UPDATE users SET totp_secret_encrypted=? WHERE id=? AND totp_enabled=0").bind(encrypted,user.id).run();
    const issuer="SPORE%20BET",label=encodeURIComponent(user.email||user.phone||user.id);
    return json({secret,otpauthUrl:`otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,message:"Add this secret to an authenticator app, then verify a current six-digit code. The secret is shown only during setup."});
  } catch { return json({error:"MFA setup is unavailable. Confirm MFA_ENCRYPTION_KEY is configured."},503); }
}
