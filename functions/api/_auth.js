const ITERATIONS = 100000;
const SESSION_DAYS = 7;

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", ...extraHeaders } });
}
export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) { const index = part.indexOf("="); if (index >= 0 && part.slice(0,index).trim() === name) return part.slice(index+1).trim(); }
  return null;
}
function toHex(bytes) { return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function fromHex(value) { if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("Invalid hash"); return new Uint8Array(value.match(/.{2}/g).map(x=>parseInt(x,16))); }
function toBase64Url(bytes) { let binary=""; for(const byte of bytes) binary+=String.fromCharCode(byte); return btoa(binary).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(bytes) { let bits=0,value=0,out=""; for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=B32[(value>>>(bits-5))&31];bits-=5;}} if(bits)out+=B32[(value<<(5-bits))&31]; return out; }
function base32Decode(text) { let bits=0,value=0,out=[]; for(const c of text.replace(/=+$/,"").toUpperCase()){const n=B32.indexOf(c);if(n<0)throw new Error("Invalid TOTP secret");value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return new Uint8Array(out); }
export async function hashPassword(password) {
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:ITERATIONS},key,256);
  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(bits)}`;
}
export async function verifyPassword(password,stored) {
  try { const [scheme,roundsText,saltHex,expectedHex]=stored.split("$");const rounds=Number(roundsText);if(scheme!=="pbkdf2-sha256"||!Number.isInteger(rounds)||rounds<10000||rounds>1000000)return false;const salt=fromHex(saltHex),expected=fromHex(expectedHex);const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const actual=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:rounds},key,expected.length*8));if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];return diff===0;}catch{return false;}
}
export async function sha256(value) { return toHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))); }
async function mfaKey(env) {
  if(typeof env.MFA_ENCRYPTION_KEY!=="string"||env.MFA_ENCRYPTION_KEY.length<32) throw new Error("MFA_ENCRYPTION_KEY must be configured with at least 32 characters.");
  const raw=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.MFA_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
export async function encryptTotpSecret(secret,env) {
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await mfaKey(env);
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(secret));
  return toBase64Url(new Uint8Array([...iv,...new Uint8Array(encrypted)]));
}
export async function decryptTotpSecret(value,env) {
  const binary=atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),key=await mfaKey(env);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes.slice(0,12)},key,bytes.slice(12));
  return new TextDecoder().decode(plain);
}
async function totpAt(secret,counter) {
  const key=await crypto.subtle.importKey("raw",base32Decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const msg=new Uint8Array(8);let n=BigInt(counter);for(let i=7;i>=0;i--){msg[i]=Number(n&255n);n>>=8n;}
  const mac=new Uint8Array(await crypto.subtle.sign("HMAC",key,msg)),offset=mac[mac.length-1]&15;
  const binary=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3];
  return String(binary%1000000).padStart(6,"0");
}
export async function verifyTotp(secret,code,now=Date.now()) {
  if(typeof code!=="string"||!/^\d{6}$/.test(code))return false;
  const step=Math.floor(now/30000);
  for(let drift=-1;drift<=1;drift++){if(await totpAt(secret,step+drift)===code)return true;}
  return false;
}
export async function createSession(db,userId) {
  const tokenBytes=crypto.getRandomValues(new Uint8Array(32)),token=toBase64Url(tokenBytes),tokenHash=await sha256(token);
  await db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").bind(crypto.randomUUID(),userId,tokenHash).run();
  return token;
}
export function sessionCookie(token) { return `spore_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS*86400}`; }
export const clearSessionCookie="spore_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
export async function currentUser(request,db) {
  const token=readCookie(request,"spore_session");if(!token||token.length>128)return null;
  const tokenHash=await sha256(token);
  return await db.prepare(
    `SELECT u.id,u.email,u.phone,u.display_name AS displayName,u.role,u.status,u.totp_enabled AS totpEnabled,
            s.admin_mfa_verified AS adminMfaVerified,w.id AS walletId,w.balance_minor AS balanceMinor,w.currency
     FROM sessions s JOIN users u ON u.id=s.user_id
     LEFT JOIN wallets w ON w.user_id=u.id AND w.wallet_type='demo'
     WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>datetime('now') AND u.status='active' LIMIT 1`
  ).bind(tokenHash).first();
}
