import { APP_CONFIG } from "../config.js";
import { fromTable } from "../supabaseClient.js";

function normalizeError(error) {
  if (!error) return null;
  return new Error(error.message || String(error));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function nullableNumber(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function hydrateListings(listings, companies, images) {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const imagesByListing = images.reduce((map, image) => {
    if (!map.has(image.listing_id)) map.set(image.listing_id, []);
    map.get(image.listing_id).push(image);
    return map;
  }, new Map());

  return listings.map((listing) => ({
    ...listing,
    company: companyById.get(listing.company_id) || null,
    images: (imagesByListing.get(listing.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  }));
}

async function attachRelated(listings) {
  if (!listings.length) return [];
  const companyIds = [...new Set(listings.map((listing) => listing.company_id).filter(Boolean))];
  const listingIds = listings.map((listing) => listing.id);

  const [companiesResult, imagesResult] = await Promise.all([
    companyIds.length
      ? fromTable(APP_CONFIG.tables.companies).select("*").in("id", companyIds)
      : Promise.resolve({ data: [], error: null }),
    fromTable(APP_CONFIG.tables.listingImages)
      .select("*")
      .in("listing_id", listingIds)
      .order("sort_order", { ascending: true }),
  ]);

  if (companiesResult.error) throw normalizeError(companiesResult.error);
  if (imagesResult.error) throw normalizeError(imagesResult.error);

  return hydrateListings(listings, asArray(companiesResult.data), asArray(imagesResult.data));
}

export async function fetchListings(filters = {}) {
  let query = fromTable(APP_CONFIG.tables.listings)
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters.listingType && filters.listingType !== "all") query = query.eq("listing_type", filters.listingType);
  if (filters.propertyType && filters.propertyType !== "all") query = query.eq("property_type", filters.propertyType);
  const maxPrice = nullableNumber(filters.maxPrice);
  const minRooms = nullableNumber(filters.minRooms);
  if (maxPrice !== null) query = query.lte("price_amount", maxPrice);
  if (minRooms !== null) query = query.gte("rooms", minRooms);
  if (filters.query) {
    const term = `%${filters.query}%`;
    query = query.or(`title.ilike.${term},city.ilike.${term},region.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await query.limit(60);
  if (error) throw normalizeError(error);
  return attachRelated(asArray(data));
}

export async function fetchListing(id) {
  const { data, error } = await fromTable(APP_CONFIG.tables.listings).select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeError(error);
  if (!data) return null;
  const hydrated = await attachRelated([data]);
  return hydrated[0] || null;
}

export async function fetchFavorites(userId) {
  if (!userId) return [];
  const { data, error } = await fromTable(APP_CONFIG.tables.favorites)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeError(error);
  return asArray(data);
}

export async function fetchFavoriteListings(userId) {
  const favorites = await fetchFavorites(userId);
  if (!favorites.length) return [];
  const ids = favorites.map((favorite) => favorite.listing_id);
  const { data, error } = await fromTable(APP_CONFIG.tables.listings).select("*").in("id", ids);
  if (error) throw normalizeError(error);
  return attachRelated(asArray(data));
}

export async function toggleFavorite({ listingId, userId, active }) {
  if (!userId) throw new Error("Sign in to save favorite homes.");
  if (active) {
    const { error } = await fromTable(APP_CONFIG.tables.favorites)
      .delete()
      .eq("user_id", userId)
      .eq("listing_id", listingId);
    if (error) throw normalizeError(error);
    return false;
  }

  const { error } = await fromTable(APP_CONFIG.tables.favorites).insert({
    user_id: userId,
    listing_id: listingId,
  });
  if (error) throw normalizeError(error);
  return true;
}

export async function fetchUserListings(userId) {
  if (!userId) return [];
  const { data, error } = await fromTable(APP_CONFIG.tables.listings)
    .select("*")
    .eq("seller_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeError(error);
  return attachRelated(asArray(data));
}

export async function fetchCompanies(userId) {
  if (!userId) return [];
  const { data, error } = await fromTable(APP_CONFIG.tables.companies)
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeError(error);
  return asArray(data);
}

export async function upsertCompany(userId, values) {
  if (!userId) throw new Error("Sign in to manage a company profile.");
  const payload = {
    id: values.id || undefined,
    owner_user_id: userId,
    name: values.name || "Nordhome seller",
    email: values.email || "",
    phone: values.phone || "",
    website: values.website || "",
    city: values.city || "",
    description: values.description || "",
  };

  const { data, error } = await fromTable(APP_CONFIG.tables.companies)
    .upsert(payload)
    .select("*")
    .single();
  if (error) throw normalizeError(error);
  return data;
}

export async function saveListingDraft(userId, values) {
  if (!userId) throw new Error("Sign in to create a listing.");
  const payload = {
    seller_user_id: userId,
    company_id: values.company_id || null,
    title: values.title || "Untitled Nordhome listing",
    description: values.description || "",
    listing_type: values.listing_type || "sale",
    property_type: values.property_type || "apartment",
    status: values.status || "draft",
    price_amount: Number.isFinite(Number(values.price_amount)) ? Number(values.price_amount) : 0,
    currency: values.currency || "SEK",
    city: values.city || "",
    region: values.region || "",
    address: values.address || "",
    postal_code: values.postal_code || "",
    latitude: nullableNumber(values.latitude),
    longitude: nullableNumber(values.longitude),
    rooms: nullableNumber(values.rooms),
    living_area: nullableNumber(values.living_area),
    plot_area: nullableNumber(values.plot_area),
    monthly_fee: nullableNumber(values.monthly_fee),
    built_year: nullableNumber(values.built_year),
    energy_class: values.energy_class || "",
    amenities: values.amenities
      ? values.amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    metadata: parseMetadata(values.metadata),
  };

  const query = values.id
    ? fromTable(APP_CONFIG.tables.listings).update(payload).eq("id", values.id).eq("seller_user_id", userId)
    : fromTable(APP_CONFIG.tables.listings).insert(payload);

  const { data, error } = await query.select("*").single();
  if (error) throw normalizeError(error);
  return data;
}

export async function archiveListing(userId, listingId) {
  const { error } = await fromTable(APP_CONFIG.tables.listings)
    .update({ status: "archived" })
    .eq("id", listingId)
    .eq("seller_user_id", userId);
  if (error) throw normalizeError(error);
}

export async function createListingImages(listingId, userId, images) {
  if (!images.length) return [];
  const rows = images.map((image, index) => ({
    listing_id: listingId,
    uploaded_by: userId,
    storage_path: image.storage_path,
    public_url: image.public_url,
    media_type: image.media_type || "image",
    alt_text: image.alt_text || "",
    sort_order: Number.isFinite(image.sort_order) ? image.sort_order : index,
    width: image.width || null,
    height: image.height || null,
  }));
  const { data, error } = await fromTable(APP_CONFIG.tables.listingImages).insert(rows).select("*");
  if (error) throw normalizeError(error);
  return asArray(data);
}

export async function sendContactMessage(values) {
  const payload = {
    listing_id: values.listing_id,
    seller_user_id: values.seller_user_id,
    sender_user_id: values.sender_user_id || null,
    sender_name: values.sender_name || "",
    sender_email: values.sender_email || "",
    sender_phone: values.sender_phone || "",
    message: values.message || "",
  };
  const { data, error } = await fromTable(APP_CONFIG.tables.contactMessages).insert(payload).select("*").single();
  if (error) throw normalizeError(error);
  return data;
}

export async function fetchListingPayments(userId) {
  if (!userId) return [];
  const { data, error } = await fromTable(APP_CONFIG.tables.listingPayments)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeError(error);
  return asArray(data);
}
