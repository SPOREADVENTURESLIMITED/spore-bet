import { json } from "./_auth.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "Payment settings are temporarily unavailable." }, 503);
  try {
    const settings = await env.DB.prepare("SELECT airtel_merchant AS airtelMerchant,mtn_merchant AS mtnMerchant,bank_name AS bankName,bank_account_number AS accountNumber,bank_branch AS branch,bank_swift AS swift,updated_at AS updatedAt FROM payment_settings WHERE id=1").first();
    if (!settings) return json({ error: "Payment settings are not initialized." }, 503);
    return json({ settings, displayOnly: true, realMoneyEnabled: false });
  } catch {
    return json({ error: "Payment settings are temporarily unavailable." }, 503);
  }
}
