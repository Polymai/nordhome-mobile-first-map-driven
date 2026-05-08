const VALID_ROUTES = new Set(["browse", "map", "listing", "create", "favorites", "account", "success"]);

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [pathPart = "", queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const routeName = segments[0] || "browse";
  const name = VALID_ROUTES.has(routeName) ? routeName : "browse";
  const query = new URLSearchParams(queryPart);
  const params = {};

  if (name === "listing") {
    params.id = decodeURIComponent(segments[1] || "");
  }

  if (name === "create" && query.get("listing")) {
    params.listing = query.get("listing");
  }

  return { name, params, query };
}

export function navigate(name, params = {}) {
  let hash = "#/browse";
  if (name === "map") hash = "#/map";
  if (name === "listing") hash = `#/listing/${encodeURIComponent(params.id || "")}`;
  if (name === "create") hash = params.listing ? `#/create?listing=${encodeURIComponent(params.listing)}` : "#/create";
  if (name === "favorites") hash = "#/favorites";
  if (name === "account") hash = "#/account";
  if (name === "success") hash = "#/success";

  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = hash;
}

export function startRouter(onRouteChange) {
  const sync = () => onRouteChange(parseHash());
  window.addEventListener("hashchange", sync);
  sync();
  return () => window.removeEventListener("hashchange", sync);
}
