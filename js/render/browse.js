import { escapeHtml } from "./shell.js";
import { APP_CONFIG, formatMinorMoney } from "../config.js";

const publishPlan = APP_CONFIG.publishPlans.standard_publish;

function publishPriceLabel() {
  return formatMinorMoney(publishPlan.amount, publishPlan.currency);
}

function formatMoney(listing) {
  const amount = Number(listing.price_amount || 0);
  if (!amount) return "Price on request";
  const currency = listing.currency || "SEK";
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function coverImage(listing) {
  return listing.images && listing.images[0] && listing.images[0].public_url
    ? listing.images[0].public_url
    : "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=80";
}

function listingCard(listing, favoriteIds) {
  const favorite = favoriteIds.has(listing.id);
  return `
    <article class="listing-card">
      <a class="listing-media" href="#/listing/${encodeURIComponent(listing.id)}">
        <img src="${escapeHtml(coverImage(listing))}" alt="${escapeHtml(listing.title)}" loading="lazy" />
      </a>
      <button
        class="icon-button favorite-button ${favorite ? "active" : ""}"
        type="button"
        data-favorite="${escapeHtml(listing.id)}"
        aria-label="${favorite ? "Remove favorite" : "Save favorite"}"
      >Save</button>
      <div class="listing-body">
        <div class="listing-title-row">
          <h3><a href="#/listing/${encodeURIComponent(listing.id)}">${escapeHtml(listing.title)}</a></h3>
          <span class="price">${escapeHtml(formatMoney(listing))}</span>
        </div>
        <p class="muted">${escapeHtml([listing.city, listing.region].filter(Boolean).join(", "))}</p>
        <div class="meta-row">
          <span class="pill">${escapeHtml(listing.listing_type === "rent" ? "Rent" : "Sale")}</span>
          <span class="pill">${escapeHtml(listing.property_type || "Home")}</span>
          ${listing.rooms ? `<span class="pill">${escapeHtml(listing.rooms)} rooms</span>` : ""}
          ${listing.living_area ? `<span class="pill">${escapeHtml(listing.living_area)} sqm</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

function loadingCards() {
  return Array.from({ length: 6 })
    .map(
      () => `
        <article class="listing-card" aria-hidden="true">
          <div class="listing-media"></div>
          <div class="listing-body">
            <span class="pill">Loading</span>
            <div class="status-card"></div>
          </div>
        </article>
      `,
    )
    .join("");
}

function filterControls(filters, compact = false) {
  return `
    <label class="field">
      <span>Search</span>
      <input name="query" value="${escapeHtml(filters.query)}" placeholder="City, address, or keyword" />
    </label>
    <label class="field">
      <span>City</span>
      <input name="city" value="${escapeHtml(filters.city)}" placeholder="Stockholm" />
    </label>
    <label class="field">
      <span>Type</span>
      <select name="listingType">
        <option value="all" ${filters.listingType === "all" ? "selected" : ""}>All</option>
        <option value="sale" ${filters.listingType === "sale" ? "selected" : ""}>For sale</option>
        <option value="rent" ${filters.listingType === "rent" ? "selected" : ""}>For rent</option>
      </select>
    </label>
    ${
      compact
        ? ""
        : `<label class="field">
            <span>Max price</span>
            <input name="maxPrice" inputmode="numeric" value="${escapeHtml(filters.maxPrice)}" placeholder="9000000" />
          </label>`
    }
  `;
}

function sellerPriceStrip() {
  return `
    <section class="seller-price-strip" aria-label="Seller pricing">
      <div class="seller-price-copy">
        <p class="eyebrow">For sellers</p>
        <h2>List your home on Nordhome</h2>
        <p>Reach buyers with a polished property page, photo gallery, saved draft, and direct seller enquiries.</p>
      </div>
      <div class="seller-price-public-card">
        <span>One-time publish price</span>
        <strong>${escapeHtml(publishPriceLabel())}</strong>
        <small>Incl. VAT. Paid once per listing.</small>
      </div>
      <ul class="seller-benefit-list" aria-label="Included in the publish price">
        <li>Live listing</li>
        <li>Photo gallery</li>
        <li>Seller enquiries</li>
        <li>Saved draft</li>
      </ul>
      <a class="button copper seller-price-action" href="#/create">Start listing</a>
    </section>
  `;
}

export function renderBrowse(state) {
  const count = state.listings.length;
  return `
    <section class="hero">
      <div class="hero-content">
        <p class="eyebrow">Nordhome marketplace</p>
        <h1>Buy and sell Nordic homes with confidence.</h1>
        <p>Browse curated property listings, save favorites, contact verified sellers, and publish your own home from one mobile-first workspace.</p>
        <div class="hero-actions">
          <a class="button" href="#/browse">Browse homes</a>
          <a class="button copper" href="#/create">List a home</a>
        </div>
      </div>
    </section>
    <section class="hero-search" aria-label="Search listings">
      <form data-form="browse-search">
        ${filterControls(state.filters, true)}
        <button class="button" type="submit">Search</button>
      </form>
    </section>
    ${sellerPriceStrip()}
    <section>
      <div class="section-heading">
        <div>
          <p class="eyebrow">${state.demoMode ? "Preview data" : "Live listings"}</p>
          <h2>${count ? `${count} homes in view` : "Homes in view"}</h2>
        </div>
        <a class="text-button" href="#/map">Explore areas</a>
      </div>
      ${
        state.errors.listings
          ? `<div class="status-card error"><strong>Listings are temporarily unavailable.</strong><p>Showing a few preview homes for now.</p></div>`
          : ""
      }
      ${
        state.loading.listings
          ? `<div class="listing-grid">${loadingCards()}</div>`
          : count
            ? `<div class="listing-grid">${state.listings.map((listing) => listingCard(listing, state.favoriteIds)).join("")}</div>`
            : `<div class="empty-card"><h3>No homes match these filters.</h3><p class="muted">Try a broader city, listing type, or price range.</p></div>`
      }
    </section>
  `;
}

export function renderMapView(state) {
  const listings = state.listings;
  return `
    <section class="section-heading">
      <div>
        <p class="eyebrow">Area search</p>
        <h1>Explore homes by location.</h1>
        <p>Search a city, address, or neighborhood to compare homes in the area.</p>
      </div>
    </section>
    <section class="map-split">
      <div class="map-shell">
        <div id="main-map" class="leaflet-map" role="application" aria-label="Nordhome property map"></div>
        <form class="map-toolbar" data-form="geocode">
          <input name="address" placeholder="Search city or address" aria-label="Search by city or address" />
          <select name="listingType" aria-label="Listing type">
            <option value="all" ${state.filters.listingType === "all" ? "selected" : ""}>All</option>
            <option value="sale" ${state.filters.listingType === "sale" ? "selected" : ""}>Sale</option>
            <option value="rent" ${state.filters.listingType === "rent" ? "selected" : ""}>Rent</option>
          </select>
          <select name="propertyType" aria-label="Property type">
            <option value="all" ${state.filters.propertyType === "all" ? "selected" : ""}>Any</option>
            <option value="apartment" ${state.filters.propertyType === "apartment" ? "selected" : ""}>Apartment</option>
            <option value="house" ${state.filters.propertyType === "house" ? "selected" : ""}>House</option>
            <option value="townhouse" ${state.filters.propertyType === "townhouse" ? "selected" : ""}>Townhouse</option>
            <option value="cabin" ${state.filters.propertyType === "cabin" ? "selected" : ""}>Cabin</option>
            <option value="land" ${state.filters.propertyType === "land" ? "selected" : ""}>Land</option>
          </select>
          <input name="maxPrice" inputmode="numeric" value="${escapeHtml(state.filters.maxPrice)}" placeholder="Max" aria-label="Maximum price" />
          <input name="minRooms" inputmode="numeric" value="${escapeHtml(state.filters.minRooms)}" placeholder="Rooms" aria-label="Minimum rooms" />
          <button class="button" type="submit">Search area</button>
          <button class="button" type="button" data-action="locate">Use location</button>
        </form>
      </div>
      <aside class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">${state.demoMode ? "Preview" : "Listings"}</p>
            <h2>${listings.length} nearby</h2>
          </div>
        </div>
        <div class="map-card-list">
          ${
            listings.length
              ? listings
                  .map(
                    (listing) => `
                      <a class="map-mini-card" href="#/listing/${encodeURIComponent(listing.id)}">
                        <strong>${escapeHtml(listing.title)}</strong>
                        <span class="muted">${escapeHtml([listing.city, formatMoney(listing)].filter(Boolean).join(" - "))}</span>
                      </a>
                    `,
                  )
                  .join("")
              : `<div class="empty-card"><p>No homes in this area yet.</p></div>`
          }
        </div>
      </aside>
    </section>
  `;
}

export function renderFavorites(state) {
  if (!state.user) {
    return `
      <section class="empty-card">
        <p class="eyebrow">Favorites</p>
        <h1>Sign in to keep a Nordic shortlist.</h1>
        <p class="muted">Sign in once and your saved homes stay with your account.</p>
        <a class="button" href="#/account">Sign in</a>
      </section>
    `;
  }

  return `
    <section class="section-heading">
      <div>
        <p class="eyebrow">Saved homes</p>
        <h1>Your shortlist</h1>
        <p>${state.favorites.length ? "Saved listings are ready for comparison." : "Save homes from browse or area search to build this view."}</p>
      </div>
    </section>
    ${
      state.favorites.length
        ? `<div class="listing-grid">${state.favorites.map((listing) => listingCard(listing, state.favoriteIds)).join("")}</div>`
        : `<div class="empty-card"><h3>No favorites yet.</h3><p class="muted">Use Save on any listing card.</p></div>`
    }
  `;
}

export function bindBrowseEvents({ onFilterSubmit, onFavoriteToggle, onGeocode, onLocate }) {
  document.querySelector('[data-form="browse-search"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onFilterSubmit(new FormData(event.currentTarget));
  });

  document.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => onFavoriteToggle(button.dataset.favorite));
  });

  document.querySelector('[data-form="geocode"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    onGeocode(new FormData(event.currentTarget));
  });

  document.querySelector('[data-action="locate"]')?.addEventListener("click", onLocate);
}
