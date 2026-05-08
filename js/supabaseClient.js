import { APP_CONFIG } from "./config.js";

const createClient = window.supabase && window.supabase.createClient;

export const supabase = createClient
  ? createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey, {
      db: { schema: APP_CONFIG.schema },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          "X-Client-Info": "polymai-app670-nordhome",
        },
      },
    })
  : null;

export function hasSupabaseClient() {
  return Boolean(supabase);
}

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase browser client is not available.");
  }
  return supabase;
}

export function fromTable(tableName) {
  return requireSupabaseClient().from(tableName);
}

export function storageBucket() {
  return requireSupabaseClient().storage.from(APP_CONFIG.storageBucket);
}

export async function currentSession() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function currentAccessToken() {
  const session = await currentSession();
  return session ? session.access_token : "";
}

export async function callEdgeFunction(functionName, payload = {}, options = {}) {
  const baseUrl = APP_CONFIG.supabase.functionsBaseUrl || APP_CONFIG.stripe.functionsBaseUrl;
  if (!baseUrl) {
    throw new Error("Supabase Functions base URL is missing.");
  }

  const token = await currentAccessToken();
  const response = await fetch(`${baseUrl}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: options.signal,
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch (_error) {
    body = { error: "Function returned a non-JSON response." };
  }

  if (!response.ok) {
    const message = body && (body.error || body.message) ? body.error || body.message : `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return body;
}
