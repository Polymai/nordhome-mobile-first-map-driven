const supabaseRuntime = window.__POLYMAI_SUPABASE_CONFIG__ || {};
const stripeRuntime = window.__POLYMAI_STRIPE_CONFIG__ || {};
const ZERO_DECIMAL_CURRENCIES = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function defaultAppUrl() {
  const path = window.location.pathname || "/";
  return `${window.location.origin}${path}`;
}

export const APP_CONFIG = Object.freeze({
  appId: "app670_nordhome",
  appName: "Nordhome",
  schema: "app670_nordhome",
  storageBucket: "app670_nordhome_media",
  tables: Object.freeze({
    profiles: "profiles",
    companies: "companies",
    listings: "listings",
    listingImages: "listing_images",
    favorites: "favorites",
    listingPayments: "listing_payments",
    contactMessages: "contact_messages",
  }),
  functions: Object.freeze({
    checkout: "app670-nordhome-mobile-first-map-driven-create-checkout-session",
    billingPortal: "app670-nordhome-mobile-first-map-driven-create-billing-portal",
    stripeWebhook: "app670-nordhome-mobile-first-map-driven-stripe-webhook",
    researchListing: "app670-nordhome-mobile-first-map-driven-research-listing",
  }),
  supabase: Object.freeze({
    url: supabaseRuntime.url || "",
    anonKey: supabaseRuntime.anonKey || "",
    functionsBaseUrl: trimSlash(supabaseRuntime.functionsBaseUrl || ""),
    siteUrl: supabaseRuntime.siteUrl || "",
  }),
  stripe: Object.freeze({
    mode: stripeRuntime.mode || "test",
    publishableKey: stripeRuntime.publishableKey || "",
    functionsBaseUrl: trimSlash(stripeRuntime.functionsBaseUrl || supabaseRuntime.functionsBaseUrl || ""),
    defaultSuccessUrl: stripeRuntime.defaultSuccessUrl || "",
    defaultCancelUrl: stripeRuntime.defaultCancelUrl || "",
    defaultPriceIds: stripeRuntime.defaultPriceIds || [],
  }),
  maps: Object.freeze({
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    geocodeUrl: "https://nominatim.openstreetmap.org/search",
    defaultCenter: [62.0, 15.0],
    defaultZoom: 5,
    userZoom: 12,
  }),
  publishPlans: Object.freeze({
    standard_publish: Object.freeze({
      key: "standard_publish",
      label: "Standard publish",
      amount: 50000,
      currency: "sek",
    }),
  }),
});

export function getAppUrl(hash = "") {
  const configured = APP_CONFIG.supabase.siteUrl || defaultAppUrl();
  const base = trimSlash(configured) || defaultAppUrl();
  return hash ? `${base}${hash}` : base;
}

export function formatMinorMoney(amount, currency = "sek") {
  const normalizedCurrency = String(currency || "sek").toLowerCase();
  const divisor = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;
  const majorAmount = Number(amount || 0) / divisor;
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: normalizedCurrency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(majorAmount);
}

export function getAuthRedirectUrl() {
  return APP_CONFIG.supabase.siteUrl || defaultAppUrl();
}

export function getCheckoutRedirects(listingId) {
  const encodedId = encodeURIComponent(listingId || "");
  return {
    successUrl:
      APP_CONFIG.stripe.defaultSuccessUrl ||
      `${getAppUrl()}#/success?session_id={CHECKOUT_SESSION_ID}&listing=${encodedId}`,
    cancelUrl: APP_CONFIG.stripe.defaultCancelUrl || `${getAppUrl()}#/create?listing=${encodedId}`,
  };
}
