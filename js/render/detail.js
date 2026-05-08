import { escapeHtml } from "./shell.js";

function formatMoney(listing) {
  const amount = Number(listing.price_amount || 0);
  if (!amount) return "Price on request";
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: listing.currency || "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function imagesFor(listing) {
  const images = listing.images && listing.images.length ? listing.images : [];
  if (images.length) return images;
  return [
    {
      public_url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=82",
      alt_text: listing.title,
    },
  ];
}

function fact(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="fact"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function metadataFor(listing) {
  if (!listing.metadata) return {};
  if (typeof listing.metadata === "object") return listing.metadata;
  try {
    const parsed = JSON.parse(listing.metadata);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function hasTextItems(items) {
  return Array.isArray(items) && items.some((item) => String(item || "").trim());
}

function neighborhoodList(label, items) {
  if (!hasTextItems(items)) return "";
  return `
    <div class="neighborhood-group">
      <h3>${escapeHtml(label)}</h3>
      <ul>
        ${items
          .filter((item) => String(item || "").trim())
          .slice(0, 5)
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}
      </ul>
    </div>
  `;
}

function renderNeighborhood(metadata) {
  const neighborhood = metadata.neighborhood && typeof metadata.neighborhood === "object" ? metadata.neighborhood : null;
  if (!neighborhood) return "";

  const summary = String(neighborhood.summary || "").trim();
  const groups = [
    neighborhoodList("Schools", neighborhood.schools),
    neighborhoodList("Shops and service", neighborhood.shops),
    neighborhoodList("Transit", neighborhood.transit),
    neighborhoodList("Nature", neighborhood.nature),
    neighborhoodList("Water", neighborhood.water),
  ].filter(Boolean);

  if (!summary && !groups.length) return "";

  return `
    <div class="panel neighborhood-panel">
      <div>
        <p class="eyebrow">Neighborhood</p>
        <h2>About the area</h2>
      </div>
      ${summary ? `<p class="muted">${escapeHtml(summary)}</p>` : ""}
      ${groups.length ? `<div class="neighborhood-grid">${groups.join("")}</div>` : ""}
    </div>
  `;
}

export function renderDetail(state) {
  const listing = state.selectedListing;
  if (state.loading.detail) {
    return `<section class="status-card"><h1>Opening listing...</h1><p class="muted">Loading property details and seller information.</p></section>`;
  }
  if (!listing) {
    return `<section class="empty-card"><h1>Listing not found.</h1><p class="muted">The home may be archived, private, or not live yet.</p><a class="button" href="#/browse">Back to browse</a></section>`;
  }

  const images = imagesFor(listing);
  const company = listing.company || {};
  const favorite = state.favoriteIds.has(listing.id);
  const metadata = metadataFor(listing);
  return `
    <section class="detail-layout">
      <div class="detail-hero">
        <div class="detail-gallery">
          <button class="gallery-main" type="button" data-action="open-gallery" aria-label="Open image full screen">
            <img src="${escapeHtml(images[0].public_url)}" alt="${escapeHtml(images[0].alt_text || listing.title)}" />
          </button>
          ${
            images.length > 1
              ? `<div class="gallery-thumbs">
                  ${images
                    .map(
                      (image, index) => `
                        <button class="gallery-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-src="${escapeHtml(image.public_url)}">
                          <img src="${escapeHtml(image.public_url)}" alt="${escapeHtml(image.alt_text || listing.title)}" />
                        </button>
                      `,
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
        <div class="detail-title">
          <div class="toolbar">
            <span class="pill">${escapeHtml(listing.city || "Nordhome")}</span>
            <span class="pill">${escapeHtml(listing.listing_type === "rent" ? "For rent" : "For sale")}</span>
            <span class="pill">${escapeHtml(listing.status || "published")}</span>
          </div>
          <h1>${escapeHtml(listing.title)}</h1>
          <div class="detail-price">${escapeHtml(formatMoney(listing))}</div>
          <p class="detail-copy">${escapeHtml(listing.description || "")}</p>
          <div class="toolbar">
            <button class="button secondary" type="button" data-action="favorite-detail">${favorite ? "Saved" : "Save"}</button>
            <button class="button secondary" type="button" data-action="share-listing">Share</button>
          </div>
        </div>
        <div class="facts-grid">
          ${fact("Rooms", listing.rooms)}
          ${fact("Living area", listing.living_area ? `${listing.living_area} sqm` : "")}
          ${fact("Monthly fee", listing.monthly_fee ? `${listing.monthly_fee} SEK` : "")}
          ${fact("Energy", listing.energy_class)}
        </div>
        ${renderNeighborhood(metadata)}
        <div class="panel">
          <h2>Location</h2>
          <p class="muted">${escapeHtml([listing.address, listing.city, listing.region].filter(Boolean).join(", "))}</p>
          <div id="detail-map" class="leaflet-map detail-map" aria-label="Listing map"></div>
        </div>
      </div>
      <aside class="seller-panel">
        <div class="seller-name">
          <div>
            <p class="eyebrow">Seller</p>
            <h2>${escapeHtml(company.name || "Nordhome seller")}</h2>
          </div>
          ${company.verified ? `<span class="pill">Verified</span>` : ""}
        </div>
        <p class="muted">${escapeHtml(company.description || "Ask for a viewing, floor plan, or seller disclosure.")}</p>
        <div class="fact-row">
          ${company.city ? `<span class="pill">${escapeHtml(company.city)}</span>` : ""}
          ${company.phone ? `<span class="pill">${escapeHtml(company.phone)}</span>` : ""}
        </div>
        <form class="contact-panel" data-form="contact">
          <input type="hidden" name="listing_id" value="${escapeHtml(listing.id)}" />
          <input type="hidden" name="seller_user_id" value="${escapeHtml(listing.seller_user_id || "")}" />
          <label class="field"><span>Name</span><input name="sender_name" required value="${escapeHtml(state.profile?.full_name || "")}" /></label>
          <label class="field"><span>Email</span><input name="sender_email" type="email" required value="${escapeHtml(state.user?.email || "")}" /></label>
          <label class="field"><span>Phone</span><input name="sender_phone" value="${escapeHtml(state.profile?.phone || "")}" /></label>
          <label class="field"><span>Message</span><textarea name="message" required>Hi, I would like to know more about ${escapeHtml(listing.title)}.</textarea></label>
          <button class="button" type="submit">Contact seller</button>
        </form>
      </aside>
    </section>
  `;
}

export function bindDetailEvents({ onFavorite, onContact, onShare }) {
  document.querySelector('[data-action="favorite-detail"]')?.addEventListener("click", onFavorite);
  document.querySelector('[data-action="share-listing"]')?.addEventListener("click", onShare);
  document.querySelector('[data-form="contact"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onContact(new FormData(event.currentTarget));
  });

  document.querySelectorAll("[data-gallery-src]").forEach((button) => {
    button.addEventListener("click", () => {
      const main = document.querySelector(".gallery-main img");
      if (main) main.src = button.dataset.gallerySrc;
      document.querySelectorAll(".gallery-thumb").forEach((thumb) => thumb.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.querySelector('[data-action="open-gallery"]')?.addEventListener("click", () => {
    const image = document.querySelector(".gallery-main img");
    const modal = document.getElementById("modal-root");
    if (!image || !modal) return;
    document.body.classList.add("modal-open");
    modal.innerHTML = `<button class="modal-backdrop" type="button" aria-label="Close image"><img class="modal-image" src="${image.src}" alt=""></button>`;
    modal.querySelector(".modal-backdrop")?.addEventListener("click", () => {
      modal.innerHTML = "";
      document.body.classList.remove("modal-open");
    });
  });
}
