import { APP_CONFIG, getAuthRedirectUrl } from "./config.js";
import { fromTable, requireSupabaseClient, supabase } from "./supabaseClient.js";

function cleanProfile(user, values = {}) {
  const metadata = user.user_metadata || {};
  return {
    user_id: user.id,
    email: user.email || values.email || "",
    full_name: values.full_name || metadata.full_name || metadata.name || "",
    phone: values.phone || "",
    role: values.role || "buyer",
  };
}

export async function bootstrapProfile(user, values = {}) {
  if (!user) return null;

  const profile = cleanProfile(user, values);
  const existing = await fromTable(APP_CONFIG.tables.profiles).select("*").eq("user_id", user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.email !== profile.email && profile.email) {
      const { data, error } = await fromTable(APP_CONFIG.tables.profiles)
        .update({ email: profile.email })
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }
    return existing.data;
  }

  const { data, error } = await fromTable(APP_CONFIG.tables.profiles).insert(profile).select("*").single();

  if (error) throw error;
  return data;
}

export async function loadSessionProfile() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  const session = data.session || null;
  if (!session) {
    return { session: null, profile: null };
  }

  const profile = await bootstrapProfile(session.user);
  return { session, profile };
}

export function watchAuth(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      callback({ session: null, profile: null });
      return;
    }

    try {
      const profile = await bootstrapProfile(session.user);
      callback({ session, profile });
    } catch (error) {
      callback({ session, profile: null, error });
    }
  });
  return () => data.subscription.unsubscribe();
}

export async function signUpWithPassword({ email, password, fullName }) {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  if (data.session) {
    await bootstrapProfile(data.session.user, { full_name: fullName, email });
  }
  return data;
}

export async function signInWithPassword({ email, password }) {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.session) {
    await bootstrapProfile(data.session.user, { email });
  }
  return data;
}

export async function signOut() {
  const client = requireSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function updateProfile(values) {
  const client = requireSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to update your Nordhome profile.");

  const payload = {
    user_id: user.id,
    email: user.email || values.email || "",
    full_name: values.full_name || "",
    phone: values.phone || "",
    role: values.role || "buyer",
  };

  const { data, error } = await fromTable(APP_CONFIG.tables.profiles)
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
