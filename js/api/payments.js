import { APP_CONFIG, getCheckoutRedirects, getAppUrl } from "../config.js";
import { callEdgeFunction } from "../supabaseClient.js";
import { fetchListingPayments } from "./listings.js";

export async function startListingCheckout(listingId) {
  if (!listingId) throw new Error("Save the listing before publishing.");
  const redirects = getCheckoutRedirects(listingId);
  const result = await callEdgeFunction(APP_CONFIG.functions.checkout, {
    action: "create_checkout_session",
    listingId,
    planKey: "standard_publish",
    successUrl: redirects.successUrl,
    cancelUrl: redirects.cancelUrl,
  });

  if (!result.url) {
    throw new Error("Checkout did not return a Stripe URL.");
  }

  window.location.assign(result.url);
  return result;
}

export async function reconcileCheckoutSession(sessionId) {
  if (!sessionId) throw new Error("Missing Checkout Session ID.");
  return callEdgeFunction(APP_CONFIG.functions.checkout, {
    action: "reconcile_session",
    sessionId,
  });
}

export async function openBillingPortal() {
  const result = await callEdgeFunction(APP_CONFIG.functions.billingPortal, {
    returnUrl: `${getAppUrl()}#/account`,
  });
  if (!result.url) throw new Error("No billing portal URL was returned.");
  window.location.assign(result.url);
  return result;
}

export async function refreshPayments(userId) {
  return fetchListingPayments(userId);
}
