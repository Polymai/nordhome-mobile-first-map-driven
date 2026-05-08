import { DEMO_LISTINGS, clearError, getState, selectDemoListing, setAuth, setError, setFavorites, setListings, setLoading, setNotice, setRoute, setState, subscribe, updateFilters } from "./state.js";
import { startRouter, navigate } from "./router.js";
import { loadSessionProfile, signInWithPassword, signOut, signUpWithPassword, updateProfile, watchAuth } from "./auth.js";
import {
  archiveListing,
  fetchCompanies,
  fetchFavoriteListings,
  fetchListing,
  fetchListingPayments,
  fetchListings,
  fetchUserListings,
  saveListingDraft,
  sendContactMessage,
  toggleFavorite,
  upsertCompany,
} from "./api/listings.js";
import { uploadListingMedia } from "./api/storage.js";
import { openBillingPortal, reconcileCheckoutSession, startListingCheckout } from "./api/payments.js";
import { researchListingDraft } from "./api/research.js";
import { geocodeAddress, locateUser, renderLeafletMap, renderLocationPicker } from "./map.js";
import { bindShellEvents, renderShell } from "./render/shell.js";
import { bindBrowseEvents, renderBrowse, renderFavorites, renderMapView } from "./render/browse.js";
import { bindDetailEvents, renderDetail } from "./render/detail.js";
import { bindEditorEvents, renderEditor } from "./render/editor.js";
import { bindAccountEvents, renderAccount, renderSuccess } from "./render/account.js";

const app = document.getElementById("app");
let didAutoCenterMap = false;
let mapViewFocus = null;
let previousRouteName = "";

function formValues(formData) {
  return Object.fromEntries(formData.entries());
}

function messageFrom(error) {
  return error && error.message ? error.message : String(error || "Unexpected error");
}

function hasCoordinates(values) {
  return String(values.latitude || "").trim() !== "" && String(values.longitude || "").trim() !== "";
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function geocodeQueriesFromDraft(values) {
  const candidates = [
    [values.address, values.postal_code, values.city, values.region, "Sweden"],
    [values.address, values.city, "Sweden"],
    [values.city, values.region, "Sweden"],
    [values.city, "Sweden"],
  ];
  const seen = new Set();
  return candidates
    .map((parts) =>
      parts
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", "),
    )
    .filter((query) => {
      if (query.length < 3 || seen.has(query)) return false;
      seen.add(query);
      return true;
    });
}

async function geocodeDraftLocation(values, options = {}) {
  const queries = geocodeQueriesFromDraft(values).slice(0, options.maxQueries || Infinity);
  let lastError = null;
  for (const query of queries) {
    try {
      const result = await geocodeAddress(query);
      return { ...result, query };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No location result found for that place.");
}

function setFieldIfUseful(form, name, value, overwrite = false) {
  const field = form.elements[name];
  const normalized = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value ?? "").trim();
  if (!field || normalized === "") return false;
  if (!overwrite && String(field.value || "").trim()) return false;
  field.value = normalized;
  return true;
}

function compactWarning(value) {
  return String(value || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function readFormMetadata(form) {
  const raw = form.elements.metadata?.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function hasNeighborhoodContent(neighborhood) {
  if (!neighborhood || typeof neighborhood !== "object") return false;
  if (String(neighborhood.summary || "").trim()) return true;
  return ["schools", "shops", "transit", "nature", "water"].some((key) =>
    Array.isArray(neighborhood[key]) && neighborhood[key].some((item) => String(item || "").trim()),
  );
}

function hasAiSuggestion(fields) {
  if (!fields || typeof fields !== "object") return false;
  return [
    fields.title,
    fields.description,
    fields.region,
    fields.postal_code,
    fields.latitude,
    fields.longitude,
    Array.isArray(fields.amenities) ? fields.amenities.join(", ") : fields.amenities,
  ].some((value) => String(value || "").trim());
}

function renderResearchSources(form, result) {
  const target = form.querySelector("[data-ai-results]");
  if (!target) return;
  target.replaceChildren();

  const sources = Array.isArray(result.sources)
    ? result.sources.filter((source) => typeof source.url === "string" && source.url.startsWith("http"))
    : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings.map(compactWarning).filter(Boolean) : [];
  const card = document.createElement("div");
  card.className = "ai-result-card";
  const title = document.createElement("strong");
  title.textContent = result.noUsableSuggestions ? "No suggestions returned" : "Draft fields updated";
  const summary = document.createElement("p");
  summary.textContent = result.noUsableSuggestions
    ? "No useful draft fields came back. Try adding more basic facts, or edit the form manually."
    : sources.length
      ? `${sources.length} source${sources.length === 1 ? "" : "s"} returned. Review all facts before saving.`
      : "Suggestions are ready for review. The location is added when the address is found.";
  card.append(title, summary);
  target.append(card);

  if (sources.length) {
    const details = document.createElement("details");
    details.className = "source-details";
    const summaryNode = document.createElement("summary");
    summaryNode.textContent = "Sources";
    const list = document.createElement("ul");
    list.className = "source-list";
    sources.slice(0, 3).forEach((source) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.title || source.url;
      item.append(link);
      list.append(item);
    });
    details.append(summaryNode, list);
    target.append(details);
  }

  if (warnings.length) {
    const note = document.createElement("p");
    note.className = "ai-note";
    note.textContent = warnings[0];
    target.append(note);
  }
}

function renderResearchError(form, message) {
  const target = form.querySelector("[data-ai-results]");
  if (!target) return;
  target.replaceChildren();
  const error = document.createElement("div");
  error.className = "status-card error";
  const title = document.createElement("strong");
  title.textContent = "Autofill could not run.";
  const copy = document.createElement("p");
  copy.textContent = message === "ai_timeout"
    ? "Autofill took too long. Try again, or use fewer details in the autofill fields."
    : message;
  error.append(title, copy);
  target.append(error);
}

function renderEditorStatus(form, message, tone = "error") {
  const target = form.querySelector("[data-editor-status]");
  if (!target) return;
  target.replaceChildren();
  if (!message) return;
  const card = document.createElement("div");
  card.className = `status-card ${tone}`;
  const copy = document.createElement("p");
  copy.textContent = message;
  card.append(copy);
  target.append(card);
}

function renderResearchLoading(form, titleText = "Preparing draft...", detailText = "Nordhome looks up the address and drafts from your form input.") {
  const target = form.querySelector("[data-ai-results]");
  if (!target) return;
  target.replaceChildren();

  const loader = document.createElement("div");
  loader.className = "ai-loader";

  const spinner = document.createElement("span");
  spinner.className = "ai-loader-spinner";
  spinner.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = titleText;
  const detail = document.createElement("p");
  detail.textContent = detailText;
  copy.append(title, detail);

  loader.append(spinner, copy);
  target.append(loader);
}

function applyResearchToForm(form, result) {
  const fields = result.fields || result;
  if (!fields || typeof fields !== "object") {
    renderResearchSources(form, result);
    return 0;
  }
  let applied = [
    setFieldIfUseful(form, "title", fields.title),
    setFieldIfUseful(form, "description", fields.description),
    setFieldIfUseful(form, "property_type", fields.property_type),
    setFieldIfUseful(form, "listing_type", fields.listing_type),
    setFieldIfUseful(form, "city", fields.city),
    setFieldIfUseful(form, "region", fields.region),
    setFieldIfUseful(form, "address", fields.address),
    setFieldIfUseful(form, "postal_code", fields.postal_code),
    setFieldIfUseful(form, "latitude", fields.latitude, true),
    setFieldIfUseful(form, "longitude", fields.longitude, true),
    setFieldIfUseful(form, "rooms", fields.rooms),
    setFieldIfUseful(form, "living_area", fields.living_area),
    setFieldIfUseful(form, "amenities", fields.amenities),
  ].filter(Boolean).length;
  if (hasNeighborhoodContent(result.neighborhood)) {
    const metadata = {
      ...readFormMetadata(form),
      neighborhood: result.neighborhood,
      research_sources: Array.isArray(result.sources) ? result.sources : [],
      research_warnings: Array.isArray(result.warnings) ? result.warnings : [],
      research_updated_at: new Date().toISOString(),
    };
    if (setFieldIfUseful(form, "metadata", JSON.stringify(metadata), true)) applied += 1;
  }
  renderResearchSources(form, applied || hasAiSuggestion(fields) ? result : { ...result, noUsableSuggestions: true });
  return applied;
}

async function addCoordinatesFromAddress(values, options = {}) {
  if (hasCoordinates(values)) return { status: "manual" };

  if (!values.address && !values.city) return { status: "skipped" };

  try {
    const result = await geocodeDraftLocation(values, options);
    values.latitude = String(result.lat);
    values.longitude = String(result.lon);
    return { status: "found" };
  } catch (error) {
    return { status: "failed", message: messageFrom(error) };
  }
}

async function withAction(task, successMessage) {
  setLoading("action", true);
  try {
    const result = await task();
    if (successMessage) setNotice(successMessage);
    return result;
  } catch (error) {
    setNotice(messageFrom(error), "error");
    return null;
  } finally {
    setLoading("action", false);
  }
}

async function loadListingsData() {
  const state = getState();
  setLoading("listings", true);
  clearError("listings");
  try {
    const listings = await fetchListings(state.filters);
    setListings(listings, false);
  } catch (error) {
    setListings(DEMO_LISTINGS, true);
    setError("listings", `${messageFrom(error)} Showing preview listings for now.`);
  } finally {
    setLoading("listings", false);
  }
}

async function loadAccountData() {
  const state = getState();
  if (!state.user) {
    setState({ companies: [], userListings: [], payments: [] });
    setFavorites([]);
    return;
  }

  setLoading("account", true);
  try {
    const [companies, userListings, favorites, payments] = await Promise.all([
      fetchCompanies(state.user.id),
      fetchUserListings(state.user.id),
      fetchFavoriteListings(state.user.id),
      fetchListingPayments(state.user.id),
    ]);
    setState({ companies, userListings, payments });
    setFavorites(favorites);
  } catch (error) {
    setNotice(messageFrom(error), "error");
  } finally {
    setLoading("account", false);
  }
}

async function loadRouteData(route) {
  if (route.name === "listing") {
    const id = route.params.id;
    if (!id) {
      setState({ selectedListing: null });
      return;
    }

    const demoListing = selectDemoListing(id);
    if (demoListing) {
      setState({ selectedListing: demoListing });
      return;
    }

    setLoading("detail", true);
    try {
      const listing = await fetchListing(id);
      setState({ selectedListing: listing });
    } catch (error) {
      setState({ selectedListing: null });
      setNotice(messageFrom(error), "error");
    } finally {
      setLoading("detail", false);
    }
  }

  if (route.name === "create" && route.params.listing && !selectDemoListing(route.params.listing)) {
    setLoading("detail", true);
    try {
      const listing = await fetchListing(route.params.listing);
      setState({ selectedListing: listing });
    } catch (error) {
      setNotice(messageFrom(error), "error");
    } finally {
      setLoading("detail", false);
    }
  }

  if (route.name === "create" && !route.params.listing) {
    setState({ selectedListing: null });
  }

  if (["account", "create", "favorites"].includes(route.name)) {
    await loadAccountData();
  }

  if (route.name === "success") {
    const sessionId = route.query.get("session_id");
    if (sessionId) {
      await withAction(async () => {
        const result = await reconcileCheckoutSession(sessionId);
        setState({ successStatus: result });
        await Promise.all([loadListingsData(), loadAccountData()]);
      });
    }
  }
}

function renderRoute(state) {
  if (state.route.name === "map") return renderMapView(state);
  if (state.route.name === "listing") return renderDetail(state);
  if (state.route.name === "create") return renderEditor(state);
  if (state.route.name === "favorites") return renderFavorites(state);
  if (state.route.name === "account") return renderAccount(state);
  if (state.route.name === "success") return renderSuccess(state);
  return renderBrowse(state);
}

function mountEditorLocationPicker() {
  const pickerMap = document.getElementById("editor-location-map");
  const form = pickerMap?.closest("form");
  if (!pickerMap || !form) return;

  const latitudeField = form.elements.latitude;
  const longitudeField = form.elements.longitude;
  const status = form.querySelector("[data-location-status]");
  renderLocationPicker(pickerMap, {
    latitude: latitudeField?.value,
    longitude: longitudeField?.value,
    onChange: ({ lat, lon }) => {
      if (latitudeField) latitudeField.value = lat.toFixed(7);
      if (longitudeField) longitudeField.value = lon.toFixed(7);
      if (status) status.textContent = "Pin set. Save the listing to use this exact position.";
    },
  });
}

function mountMaps(state) {
  const mainMap = document.getElementById("main-map");
  if (mainMap) {
    const mapOptions = {
      onMarkerClick: (listing) => navigate("listing", { id: listing.id }),
    };
    if (mapViewFocus) {
      mapOptions.center = mapViewFocus.center;
      mapOptions.zoom = mapViewFocus.zoom;
    } else {
      mapOptions.preferUserLocation = !didAutoCenterMap;
    }
    renderLeafletMap(mainMap, state.listings, mapOptions);
    didAutoCenterMap = true;
  }

  const detailMap = document.getElementById("detail-map");
  if (detailMap && state.selectedListing) {
    renderLeafletMap(detailMap, [state.selectedListing], { scrollWheelZoom: false, zoom: 13 });
  }

  mountEditorLocationPicker();
}

function bindRouteEvents(state) {
  bindBrowseEvents({
    onFilterSubmit: async (data) => {
      updateFilters(formValues(data));
      await loadListingsData();
      if (getState().route.name !== "browse") navigate("browse");
    },
    onFavoriteToggle: (listingId) => handleFavorite(listingId),
    onGeocode: async (data) => {
      const values = formValues(data);
      const address = String(values.address || "").trim();
      const nextFilters = {
        listingType: values.listingType || "all",
        propertyType: values.propertyType || "all",
        maxPrice: values.maxPrice || "",
        minRooms: values.minRooms || "",
      };
      await withAction(async () => {
        updateFilters(nextFilters);
        await loadListingsData();
        if (address) {
          const result = await geocodeAddress(address);
          mapViewFocus = { center: [result.lat, result.lon], zoom: 13 };
        }
        const element = document.getElementById("main-map");
        if (element) {
          const options = mapViewFocus ? { center: mapViewFocus.center, zoom: mapViewFocus.zoom } : {};
          renderLeafletMap(element, getState().listings, options);
        }
      }, address ? "Search updated and place found." : "Search updated.");
    },
    onLocate: () => locateUser(document.getElementById("main-map")),
  });

  if (state.route.name === "listing") {
    bindDetailEvents({
      onFavorite: () => state.selectedListing && handleFavorite(state.selectedListing.id),
      onContact: (data) => handleContact(data),
      onShare: () => handleShare(),
    });
  }

  if (state.route.name === "create") {
    bindEditorEvents({
      onSaveDraft: (form) => handleSaveDraft(form),
      onPublish: (listingId, button) => handlePublish(listingId, button),
      onResearch: (form) => handleResearchListing(form),
    });
  }

  if (state.route.name === "account") {
    bindAccountEvents({
      onSignIn: (data) => handleSignIn(data),
      onSignUp: (data) => handleSignUp(data),
      onProfile: (data) => handleProfile(data),
      onCompany: (data) => handleCompany(data),
      onBilling: () => withAction(() => openBillingPortal()),
      onPublish: (listingId, button) => handlePublish(listingId, button),
      onArchive: (listingId) => handleArchive(listingId),
      onSignOut: () => handleSignOut(),
    });
  }
}

function handleSignOut() {
  return withAction(async () => {
    await signOut();
    setAuth(null, null);
    setFavorites([]);
    navigate("browse");
  }, "Signed out.");
}

function renderApp() {
  const state = getState();
  app.innerHTML = renderShell(state, renderRoute(state));
  bindShellEvents({
    onSignOut: () => handleSignOut(),
    onClearNotice: () => setNotice(null),
  });
  bindRouteEvents(state);
  mountMaps(state);
}

async function handleFavorite(listingId) {
  const state = getState();
  if (!state.user) {
    setNotice("Sign in to save favorite homes.", "error");
    navigate("account");
    return;
  }

  await withAction(async () => {
    await toggleFavorite({
      listingId,
      userId: state.user.id,
      active: state.favoriteIds.has(listingId),
    });
    await loadAccountData();
  }, "Favorites updated.");
}

async function handleContact(data) {
  const state = getState();
  if (state.demoMode) {
    setNotice("Messages are disabled for preview listings.", "error");
    return;
  }

  await withAction(async () => {
    await sendContactMessage({
      ...formValues(data),
      sender_user_id: state.user ? state.user.id : null,
    });
  }, "Message sent to the seller.");
}

async function handleSaveDraft(form) {
  const state = getState();
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent || "Save listing";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }
  renderEditorStatus(form, "");

  try {
    const data = new FormData(form);
    const values = formValues(data);
    const imageFiles = Array.from(form.elements.images?.files || []);
    const floorFiles = Array.from(form.elements.floor_plans?.files || []);
    renderEditorStatus(form, "Checking location...", "success");
    let geocodeResult = { status: "skipped" };
    try {
      geocodeResult = await withTimeout(
        addCoordinatesFromAddress(values, { maxQueries: 2 }),
        5000,
        "Coordinate check timed out.",
      );
    } catch (error) {
      geocodeResult = { status: "failed", message: messageFrom(error) };
    }

    renderEditorStatus(form, "Saving listing...", "success");
    const saved = await withTimeout(
      saveListingDraft(state.user.id, values),
      20000,
      "Saving timed out. Check your connection and try again.",
    );

    if (imageFiles.length) {
      renderEditorStatus(form, "Uploading property images...", "success");
      await withTimeout(
        uploadListingMedia({ listingId: saved.id, userId: state.user.id, files: imageFiles }),
        45000,
        "Image upload timed out. The listing was saved; try uploading images again.",
      );
    }
    if (floorFiles.length) {
      renderEditorStatus(form, "Uploading floor plans...", "success");
      await withTimeout(
        uploadListingMedia({ listingId: saved.id, userId: state.user.id, files: floorFiles, mediaType: "floor_plan" }),
        45000,
        "Floor plan upload timed out. The listing was saved; try uploading floor plans again.",
      );
    }
    const refreshed = await withTimeout(
      fetchListing(saved.id),
      10000,
      "Listing saved, but media preview could not refresh yet.",
    ).catch(() => saved);
    const query = new URLSearchParams();
    query.set("listing", saved.id);
    setState({ route: { name: "create", params: { listing: saved.id }, query }, selectedListing: refreshed || saved });
    navigate("create", { listing: saved.id });

    if (geocodeResult.status === "found") {
      setNotice("Listing saved with exact location.");
    } else if (geocodeResult.status === "failed") {
      setNotice(`Listing saved. Exact location was not found automatically: ${geocodeResult.message}`, "error");
    } else {
      setNotice("Listing saved.");
    }

    Promise.all([loadListingsData(), loadAccountData()]).catch((error) => {
      setNotice(`Listing saved, but refresh failed: ${messageFrom(error)}`, "error");
    });
  } catch (error) {
    renderEditorStatus(form, messageFrom(error), "error");
  } finally {
    if (submitButton && form.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
}

async function handleResearchListing(form) {
  const button = form.querySelector('[data-action="research-listing"]');
  const originalText = button?.textContent || "Autofill from address";
  const addressField = form.elements.research_address;
  const cityField = form.elements.research_city;
  if (!addressField?.value.trim() || !cityField?.value.trim()) {
    renderResearchError(form, "Add address and city first.");
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = "Autofilling...";
  }
  renderResearchLoading(form);

  try {
    const values = formValues(new FormData(form));
    values.address = String(values.research_address || values.address || "").trim();
    values.city = String(values.research_city || values.city || "").trim();
    values.property_type = String(values.research_property_type || values.property_type || "").trim();
    values.listing_type = String(values.research_listing_type || values.listing_type || "").trim();
    values.rooms = String(values.research_rooms || values.rooms || "").trim();
    values.living_area = String(values.research_living_area || values.living_area || "").trim();
    setFieldIfUseful(form, "address", values.address);
    setFieldIfUseful(form, "city", values.city);
    setFieldIfUseful(form, "property_type", values.property_type, true);
    setFieldIfUseful(form, "listing_type", values.listing_type, true);
    setFieldIfUseful(form, "rooms", values.rooms);
    setFieldIfUseful(form, "living_area", values.living_area);

    let geocodeWarning = "";
    renderResearchLoading(
      form,
      "Finding location...",
      "Nordhome looks up the address before preparing the listing text.",
    );
    try {
      const geocode = await geocodeDraftLocation(values);
      values.latitude = String(geocode.lat);
      values.longitude = String(geocode.lon);
      setFieldIfUseful(form, "latitude", values.latitude, true);
      setFieldIfUseful(form, "longitude", values.longitude, true);
      mountEditorLocationPicker();
      renderResearchLoading(
        form,
        "Preparing draft...",
        "Coordinates are ready. Nordhome is filling suggested fields.",
      );
    } catch (error) {
      geocodeWarning = `Location lookup could not place this address: ${messageFrom(error)}`;
      renderResearchLoading(
        form,
        "Preparing draft...",
        "Coordinates were not found automatically. Nordhome will still suggest listing text.",
      );
    }

    const research = await researchListingDraft(values);
    const researchWithGeocode = geocodeWarning
      ? {
          ...research,
          warnings: [geocodeWarning, ...(Array.isArray(research.warnings) ? research.warnings : [])],
        }
      : research;
    const applied = applyResearchToForm(form, researchWithGeocode);
    if (!applied) {
      renderResearchSources(form, {
        ...researchWithGeocode,
        warnings: [
          ...(Array.isArray(researchWithGeocode.warnings) ? researchWithGeocode.warnings : []),
          "No empty form fields were changed. Clear a field first if you want autofill to replace it.",
        ],
      });
    }
  } catch (error) {
    renderResearchError(form, messageFrom(error));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function handlePublish(listingId, button) {
  const originalText = button?.textContent || "Pay to publish";
  if (button) {
    button.disabled = true;
    button.textContent = "Opening checkout...";
    button.setAttribute("aria-busy", "true");
  }
  try {
    await startListingCheckout(listingId);
  } catch (error) {
    setNotice(messageFrom(error), "error");
  } finally {
    if (button && button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
      button.removeAttribute("aria-busy");
    }
  }
}

async function handleArchive(listingId) {
  const state = getState();
  await withAction(async () => {
    await archiveListing(state.user.id, listingId);
    await loadAccountData();
    await loadListingsData();
  }, "Listing archived.");
}

async function handleSignIn(data) {
  await withAction(async () => {
    await signInWithPassword({
      email: data.get("email"),
      password: data.get("password"),
    });
    const { session, profile } = await loadSessionProfile();
    setAuth(session, profile);
    await loadAccountData();
  }, "Signed in.");
}

async function handleSignUp(data) {
  await withAction(async () => {
    const result = await signUpWithPassword({
      email: data.get("email"),
      password: data.get("password"),
      fullName: data.get("fullName"),
    });
    if (result.session) {
      const { session, profile } = await loadSessionProfile();
      setAuth(session, profile);
      await loadAccountData();
    }
  }, "Account created. Check email if confirmation is required.");
}

async function handleProfile(data) {
  await withAction(async () => {
    const profile = await updateProfile(formValues(data));
    setState({ profile });
  }, "Profile saved.");
}

async function handleCompany(data) {
  const state = getState();
  await withAction(async () => {
    await upsertCompany(state.user.id, formValues(data));
    await loadAccountData();
  }, "Company saved.");
}

function handleShare() {
  const listing = getState().selectedListing;
  if (!listing) return;
  const url = `${window.location.origin}${window.location.pathname}#/listing/${encodeURIComponent(listing.id)}`;
  if (navigator.share) {
    navigator.share({ title: listing.title, url }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(url);
  setNotice("Listing link copied.");
}

async function boot() {
  subscribe(renderApp);
  renderApp();
  try {
    const { session, profile } = await loadSessionProfile();
    setAuth(session, profile);
  } catch (error) {
    setNotice(`Account setup is not ready yet. ${messageFrom(error)}`, "error");
  }

  watchAuth(async ({ session, profile, error }) => {
    if (error) setNotice(messageFrom(error), "error");
    setAuth(session, profile);
    await loadAccountData();
  });

  await loadListingsData();
  startRouter(async (route) => {
    if (previousRouteName !== route.name) {
      didAutoCenterMap = false;
      mapViewFocus = null;
      previousRouteName = route.name;
    }
    setRoute(route);
    await loadRouteData(route);
  });
  setLoading("boot", false);
}

boot();
