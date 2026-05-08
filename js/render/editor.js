import { escapeHtml } from "./shell.js";
import { APP_CONFIG, formatMinorMoney } from "../config.js";

const publishPlan = APP_CONFIG.publishPlans.standard_publish;

function publishPriceLabel() {
  return formatMinorMoney(publishPlan.amount, publishPlan.currency);
}

function currentListing(state) {
  return state.selectedListing && state.route.params.listing ? state.selectedListing : null;
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function publishAction(listing) {
  if (!listing.id) return "";
  const status = listing.status || "draft";
  if (["draft", "pending_payment", "payment_failed"].includes(status)) {
    return `<button class="button copper" type="button" data-action="publish-listing" data-listing-id="${escapeHtml(listing.id)}">Pay ${escapeHtml(publishPriceLabel())}</button>`;
  }
  if (status === "published") {
    return `<a class="button secondary" href="#/listing/${encodeURIComponent(listing.id)}">View published listing</a>`;
  }
  return "";
}

function publishPackageCard({ showStartAction = false, listingId = "" } = {}) {
  return `
    <aside class="seller-panel">
      <p class="eyebrow">Publish package</p>
      <h2>Standard Nordhome listing</h2>
      <div class="publish-price-card">
        <span>One-time publish price</span>
        <strong>${escapeHtml(publishPriceLabel())}</strong>
        <small>Incl. VAT. Pay once per listing.</small>
      </div>
      <p class="muted">Publish your home on Nordhome with a gallery, location details, and seller enquiries included.</p>
      <div class="fact-row">
        <span class="pill">Live listing</span>
        <span class="pill">Photo gallery</span>
        <span class="pill">Seller enquiries</span>
      </div>
      ${
        showStartAction
          ? `<a class="button copper" href="#/account">Sign in to list</a>`
          : listingId
            ? `<a class="text-button" href="#/listing/${encodeURIComponent(listingId)}">Preview listing</a>`
            : `<p class="muted">Save the listing first, then add photos and publish.</p>`
      }
    </aside>
  `;
}

function mediaPreview(listing, mediaType, label) {
  const items = (listing.images || []).filter((item) => (item.media_type || "image") === mediaType);
  if (!items.length) return "";
  return `
    <div class="editor-media-preview">
      <span class="field-label">${escapeHtml(label)}</span>
      <div class="editor-media-grid">
        ${items
          .map((item) => {
            const title = escapeHtml(item.alt_text || item.storage_path || label);
            if (mediaType === "floor_plan" && !String(item.public_url || "").match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)) {
              return `<a class="editor-file-chip" href="${escapeHtml(item.public_url)}" target="_blank" rel="noreferrer">${title}</a>`;
            }
            return `
              <figure>
                <img src="${escapeHtml(item.public_url)}" alt="${title}" loading="lazy" />
                <figcaption>${title}</figcaption>
              </figure>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

export function renderEditor(state) {
  if (!state.user) {
    return `
      <section class="section-heading">
        <div>
          <p class="eyebrow">Seller workspace</p>
          <h1>Create a Nordhome listing.</h1>
          <p>See the publish price before signing in, then create an account when you are ready to save a draft.</p>
        </div>
      </section>
      <section class="detail-layout">
        <div class="empty-card">
          <h2>Sign in to start listing</h2>
          <p class="muted">Use your account to save drafts, manage photos, and publish homes.</p>
          <a class="button" href="#/account">Sign in</a>
        </div>
        ${publishPackageCard({ showStartAction: true })}
      </section>
    `;
  }

  const listing = currentListing(state) || {};
  const companyOptions = state.companies
    .map((company) => option(company.id, company.name, listing.company_id || ""))
    .join("");

  return `
    <section class="section-heading">
      <div>
        <p class="eyebrow">Create listing</p>
        <h1>${listing.id ? "Refine your draft" : "Create a Nordhome listing"}</h1>
        <p>Add the property details, upload photos, and publish when the listing is ready.</p>
      </div>
    </section>
    <section class="detail-layout">
      <form class="editor-panel" data-form="listing-editor">
        <input type="hidden" name="id" value="${escapeHtml(listing.id || "")}" />
        <input type="hidden" name="metadata" value="${escapeHtml(JSON.stringify(listing.metadata || {}))}" />
        <input type="hidden" name="latitude" value="${escapeHtml(listing.latitude || "")}" />
        <input type="hidden" name="longitude" value="${escapeHtml(listing.longitude || "")}" />
        <div class="ai-autofill-panel">
          <div>
            <p class="eyebrow">Autofill</p>
            <h3>Start with the facts you know</h3>
            <p class="muted">Add the address and a few basic facts. Nordhome can suggest a cleaner listing draft.</p>
          </div>
          <div class="ai-brief-grid">
            <label class="field">
              <span>Address or place</span>
              <input name="research_address" required value="${escapeHtml(listing.address || "")}" placeholder="Brannemysten 21B" />
            </label>
            <label class="field">
              <span>City</span>
              <input name="research_city" required value="${escapeHtml(listing.city || "")}" placeholder="Goteborg" />
            </label>
            <label class="field">
              <span>Property type</span>
              <select name="research_property_type" required>
                ${option("apartment", "Apartment", listing.property_type || "apartment")}
                ${option("house", "House", listing.property_type || "apartment")}
                ${option("townhouse", "Townhouse", listing.property_type || "apartment")}
                ${option("cabin", "Cabin", listing.property_type || "apartment")}
                ${option("land", "Land", listing.property_type || "apartment")}
              </select>
            </label>
            <label class="field">
              <span>Listing type</span>
              <select name="research_listing_type" required>
                ${option("sale", "For sale", listing.listing_type || "sale")}
                ${option("rent", "For rent", listing.listing_type || "sale")}
              </select>
            </label>
            <label class="field">
              <span>Rooms</span>
              <input name="research_rooms" inputmode="decimal" value="${escapeHtml(listing.rooms || "")}" placeholder="4" />
            </label>
            <label class="field">
              <span>Living area sqm</span>
              <input name="research_living_area" inputmode="numeric" value="${escapeHtml(listing.living_area || "")}" placeholder="120" />
            </label>
          </div>
          <button class="button secondary" type="button" data-action="research-listing">Autofill from address</button>
          <div class="ai-research-results" data-ai-results></div>
        </div>
        <div class="form-grid two">
          <label class="field">
            <span>Company</span>
            <select name="company_id">
              <option value="">No company selected</option>
              ${companyOptions}
            </select>
          </label>
          <label class="field">
            <span>Listing type</span>
            <select name="listing_type">
              ${option("sale", "For sale", listing.listing_type || "sale")}
              ${option("rent", "For rent", listing.listing_type || "sale")}
            </select>
          </label>
        </div>
        <label class="field"><span>Title</span><input name="title" required value="${escapeHtml(listing.title || "")}" placeholder="Calm apartment near Humlegarden" /></label>
        <label class="field"><span>Description</span><textarea name="description" required placeholder="Light, materials, neighborhood, viewings...">${escapeHtml(listing.description || "")}</textarea></label>
        <div class="form-grid two">
          <label class="field"><span>Property type</span><select name="property_type">
            ${option("apartment", "Apartment", listing.property_type || "apartment")}
            ${option("house", "House", listing.property_type || "apartment")}
            ${option("townhouse", "Townhouse", listing.property_type || "apartment")}
            ${option("cabin", "Cabin", listing.property_type || "apartment")}
            ${option("land", "Land", listing.property_type || "apartment")}
          </select></label>
          <label class="field"><span>Price</span><input name="price_amount" inputmode="numeric" required value="${escapeHtml(listing.price_amount || "")}" /></label>
          <label class="field"><span>City</span><input name="city" required value="${escapeHtml(listing.city || "")}" /></label>
          <label class="field"><span>Region</span><input name="region" value="${escapeHtml(listing.region || "")}" /></label>
          <label class="field"><span>Address</span><input name="address" value="${escapeHtml(listing.address || "")}" /></label>
          <label class="field"><span>Postal code</span><input name="postal_code" value="${escapeHtml(listing.postal_code || "")}" /></label>
          <label class="field"><span>Rooms</span><input name="rooms" inputmode="decimal" value="${escapeHtml(listing.rooms || "")}" /></label>
          <label class="field"><span>Living area sqm</span><input name="living_area" inputmode="numeric" value="${escapeHtml(listing.living_area || "")}" /></label>
          <label class="field"><span>Monthly fee</span><input name="monthly_fee" inputmode="numeric" value="${escapeHtml(listing.monthly_fee || "")}" /></label>
          <label class="field"><span>Built year</span><input name="built_year" inputmode="numeric" value="${escapeHtml(listing.built_year || "")}" /></label>
        </div>
        <div class="location-picker-panel">
          <div>
            <span class="field-label">Exact location</span>
            <p class="muted">Click or drag the pin to set the precise property position.</p>
          </div>
          <div id="editor-location-map" class="leaflet-map location-picker-map" aria-label="Set exact listing location"></div>
          <p class="muted location-picker-status" data-location-status>${
            listing.latitude && listing.longitude
              ? "Pin is set. Move it if the position needs adjusting."
              : "No pin set yet. Drop a pin before saving if the address lookup is not exact."
          }</p>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Energy class</span><input name="energy_class" value="${escapeHtml(listing.energy_class || "")}" placeholder="A, B, C" /></label>
          <label class="field"><span>Amenities</span><input name="amenities" value="${escapeHtml((listing.amenities || []).join(", "))}" placeholder="Balcony, elevator, parking" /></label>
        </div>
        ${mediaPreview(listing, "image", "Saved property images")}
        <label class="upload-drop">
          <span class="field-label">Property images</span>
          <input name="images" type="file" accept="image/*" multiple />
          <span>Add clear photos for the listing gallery.</span>
        </label>
        ${mediaPreview(listing, "floor_plan", "Saved floor plans")}
        <label class="upload-drop">
          <span class="field-label">Floor plans</span>
          <input name="floor_plans" type="file" accept="image/*,application/pdf" multiple />
          <span>Add floor plans or supporting documents for interested buyers.</span>
        </label>
        <div class="toolbar">
          <button class="button" type="submit">${listing.id ? "Save changes" : "Save listing"}</button>
          ${publishAction(listing)}
        </div>
        <div data-editor-status></div>
      </form>
      ${publishPackageCard({ listingId: listing.id || "" })}
    </section>
  `;
}

export function bindEditorEvents({ onSaveDraft, onPublish, onResearch }) {
  document.querySelector('[data-form="listing-editor"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onSaveDraft(event.currentTarget);
  });
  document.querySelector('[data-action="publish-listing"]')?.addEventListener("click", (event) => {
    onPublish(event.currentTarget.dataset.listingId, event.currentTarget);
  });
  document.querySelector('[data-action="research-listing"]')?.addEventListener("click", (event) => {
    const form = event.currentTarget.closest("form");
    if (form) onResearch(form);
  });
}
