import { APP_CONFIG } from "../config.js";
import { callEdgeFunction } from "../supabaseClient.js";

function cleanDraft(values) {
  const address = values.research_address || values.address || "";
  const city = values.research_city || values.city || "";
  return {
    title: values.title || "",
    description: values.description || "",
    listing_type: values.research_listing_type || values.listing_type || "sale",
    property_type: values.research_property_type || values.property_type || "apartment",
    city,
    region: values.region || "",
    address,
    postal_code: values.postal_code || "",
    latitude: values.latitude || "",
    longitude: values.longitude || "",
    rooms: values.research_rooms || values.rooms || "",
    living_area: values.research_living_area || values.living_area || "",
    amenities: values.amenities || "",
  };
}

export async function researchListingDraft(values) {
  const draft = cleanDraft(values);
  if (!draft.address && !draft.city) {
    throw new Error("Add at least a city or address before using AI autofill.");
  }

  return callEdgeFunction(APP_CONFIG.functions.researchListing, {
    action: "research_listing",
    draft,
  });
}
