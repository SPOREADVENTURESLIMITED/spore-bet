import { json } from "./_auth.js";

export async function onRequestGet() {
  return json({
    paymentMethods: [],
    available: false,
    realMoneyEnabled: false,
    message: "Payment channels will be published only after provider onboarding and the regulated launch approval."
  });
}
