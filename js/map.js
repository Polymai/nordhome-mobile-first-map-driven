import { APP_CONFIG } from "./config.js";

const mapRegistry = new WeakMap();
const geocodeCache = new Map(JSON.parse(window.localStorage.getItem("nordhome_geocode_cache") || "[]"));

function hasCoordinates(listing) {
  return Number.isFinite(Number(listing.latitude)) && Number.isFinite(Number(listing.longitude));
}

function compactPrice(listing) {
  const value = Number(listing.price_amount || 0);
  if (!value) return "Ask";
  if (value >= 1000000) {
    const millions = value / 1000000;
    const label = millions >= 10 ? String(Math.round(millions)) : millions.toFixed(1).replace(".", ",");
    return `${label} Mkr`;
  }
  if (value >= 1000) return `${Math.round(value / 1000)} tkr`;
  return `${value} kr`;
}

function markerIcon(listing) {
  return L.divIcon({
    className: "",
    html: `<span class="nordhome-marker">${compactPrice(listing)}</span>`,
    iconSize: [84, 34],
    iconAnchor: [42, 34],
    popupAnchor: [0, -32],
  });
}

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<span class="location-pin-marker" aria-hidden="true"></span>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
  });
}

function markerPopup(listing) {
  const image = listing.images && listing.images[0] ? listing.images[0].public_url : "";
  return `
    <article class="map-mini-card">
      ${image ? `<img class="map-popup-image" src="${image}" alt="">` : ""}
      <strong>${listing.title}</strong>
      <span>${listing.city || ""} ${listing.rooms ? `- ${listing.rooms} rooms` : ""}</span>
      <a class="text-button" href="#/listing/${encodeURIComponent(listing.id)}">Open listing</a>
    </article>
  `;
}

function clearMap(element) {
  const mapState = mapRegistry.get(element);
  if (!mapState) return;
  if (mapState.resizeObserver) mapState.resizeObserver.disconnect();
  mapState.map.remove();
  mapRegistry.delete(element);
}

function scheduleMapLayout(element, map, applyInitialViewport) {
  let didApplyInitialViewport = false;
  const refresh = () => {
    const state = mapRegistry.get(element);
    if (!state || state.map !== map) return;
    map.invalidateSize();
    if (!didApplyInitialViewport && element.clientWidth > 0 && element.clientHeight > 0) {
      didApplyInitialViewport = true;
      applyInitialViewport();
      window.setTimeout(() => {
        if (mapRegistry.get(element)?.map === map) map.invalidateSize();
      }, 80);
    }
  };

  window.requestAnimationFrame(() => window.requestAnimationFrame(refresh));
  [120, 360, 900].forEach((delay) => window.setTimeout(refresh, delay));

  if (!window.ResizeObserver) return null;
  const observer = new ResizeObserver(refresh);
  observer.observe(element);
  return observer;
}

export function renderLeafletMap(element, listings, options = {}) {
  if (!element || !window.L) return null;

  clearMap(element);

  const withCoordinates = listings.filter(hasCoordinates);
  const center = options.center || APP_CONFIG.maps.defaultCenter;
  const map = L.map(element, { zoomControl: true, scrollWheelZoom: options.scrollWheelZoom !== false }).setView(
    center,
    options.zoom || APP_CONFIG.maps.defaultZoom,
  );

  L.tileLayer(APP_CONFIG.maps.tileUrl, {
    maxZoom: 19,
    attribution: APP_CONFIG.maps.attribution,
  }).addTo(map);

  const layer = window.L.markerClusterGroup ? L.markerClusterGroup({ showCoverageOnHover: false }) : L.layerGroup();
  withCoordinates.forEach((listing) => {
    const marker = L.marker([Number(listing.latitude), Number(listing.longitude)], { icon: markerIcon(listing) });
    marker.bindPopup(markerPopup(listing));
    marker.on("click", () => {
      if (options.onMarkerClick) options.onMarkerClick(listing);
    });
    layer.addLayer(marker);
  });
  layer.addTo(map);

  if (options.onBoundsChange) {
    map.on("moveend", () => {
      const bounds = map.getBounds();
      const visibleIds = withCoordinates
        .filter((listing) => bounds.contains([Number(listing.latitude), Number(listing.longitude)]))
        .map((listing) => listing.id);
      options.onBoundsChange(visibleIds);
    });
  }

  const applyInitialViewport = () => {
    if (options.preferUserLocation) {
      centerOnUserOrSweden(element);
      return;
    }
    if (withCoordinates.length && !options.center) {
      const bounds = L.latLngBounds(withCoordinates.map((listing) => [Number(listing.latitude), Number(listing.longitude)]));
      map.fitBounds(bounds.pad(0.18), { maxZoom: 13 });
    }
  };
  const resizeObserver = scheduleMapLayout(element, map, applyInitialViewport);
  mapRegistry.set(element, { map, layer, resizeObserver });
  return map;
}

export function renderLocationPicker(element, options = {}) {
  if (!element || !window.L) return null;

  clearMap(element);

  const initialLat = Number(options.latitude);
  const initialLon = Number(options.longitude);
  const hasInitialPoint = Number.isFinite(initialLat) && Number.isFinite(initialLon);
  const initialCenter = hasInitialPoint ? [initialLat, initialLon] : APP_CONFIG.maps.defaultCenter;
  const map = L.map(element, { zoomControl: true, scrollWheelZoom: true }).setView(
    initialCenter,
    hasInitialPoint ? 16 : APP_CONFIG.maps.defaultZoom,
  );

  L.tileLayer(APP_CONFIG.maps.tileUrl, {
    maxZoom: 19,
    attribution: APP_CONFIG.maps.attribution,
  }).addTo(map);

  let marker = null;
  const commitPin = (latLng) => {
    const lat = Number(latLng.lat);
    const lon = Number(latLng.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true, icon: pinIcon(), autoPan: true }).addTo(map);
      marker.on("dragend", () => commitPin(marker.getLatLng()));
    } else {
      marker.setLatLng([lat, lon]);
    }
    if (options.onChange) options.onChange({ lat, lon });
  };

  map.on("click", (event) => commitPin(event.latlng));
  if (hasInitialPoint) commitPin({ lat: initialLat, lng: initialLon });

  const resizeObserver = scheduleMapLayout(element, map, () => {
    if (hasInitialPoint) map.setView(initialCenter, 16);
  });
  mapRegistry.set(element, { map, marker, resizeObserver });
  return map;
}

export function locateUser(element) {
  const state = mapRegistry.get(element);
  if (!state) return;
  state.map.locate({ setView: true, maxZoom: 13 });
}

export function centerOnUserOrSweden(element) {
  const state = mapRegistry.get(element);
  if (!state) return false;

  state.map.setView(APP_CONFIG.maps.defaultCenter, APP_CONFIG.maps.defaultZoom);
  if (!navigator.geolocation) return false;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (mapRegistry.get(element)?.map !== state.map) return;
      const latLng = [position.coords.latitude, position.coords.longitude];
      state.map.setView(latLng, APP_CONFIG.maps.userZoom);
      L.circleMarker(latLng, {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#b86f46",
        fillOpacity: 1,
      })
        .addTo(state.map)
        .bindPopup("Your location");
    },
    () => {
      if (mapRegistry.get(element)?.map !== state.map) return;
      state.map.setView(APP_CONFIG.maps.defaultCenter, APP_CONFIG.maps.defaultZoom);
    },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
  );
  return true;
}

export async function geocodeAddress(address) {
  const normalized = String(address || "").trim();
  if (normalized.length < 3) throw new Error("Enter a city or address to search.");
  if (geocodeCache.has(normalized)) return geocodeCache.get(normalized);

  const url = new URL(APP_CONFIG.maps.geocodeUrl);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "se");
  url.searchParams.set("accept-language", "sv,en");
  url.searchParams.set("q", normalized);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  let results;
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Geocoding failed with HTTP ${response.status}.`);
    results = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Geocoding timed out.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
  const first = results[0];
  if (!first) throw new Error("No location result found for that place.");

  const value = { lat: Number(first.lat), lon: Number(first.lon), label: first.display_name };
  geocodeCache.set(normalized, value);
  window.localStorage.setItem("nordhome_geocode_cache", JSON.stringify([...geocodeCache.entries()].slice(-40)));
  return value;
}
