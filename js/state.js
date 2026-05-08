export const DEMO_LISTINGS = [
  {
    id: "demo-vasastan-attic",
    title: "Quiet attic home above Vasastan",
    description:
      "A bright top-floor home with oak floors, built-in storage, and a calm courtyard outlook near cafes and transit.",
    listing_type: "sale",
    property_type: "apartment",
    status: "published",
    price_amount: 7420000,
    currency: "SEK",
    city: "Stockholm",
    region: "Stockholm County",
    address: "Upplandsgatan 42",
    latitude: 59.3424,
    longitude: 18.0469,
    rooms: 3,
    living_area: 78,
    monthly_fee: 3920,
    energy_class: "C",
    amenities: ["Balcony", "Elevator", "Courtyard"],
    company: { name: "Lind & Co Homes", city: "Stockholm", verified: true, phone: "+46 8 12 45 90" },
    images: [
      {
        public_url:
          "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
        alt_text: "Bright Scandinavian living room",
      },
    ],
  },
  {
    id: "demo-malmo-townhouse",
    title: "Brick townhouse close to Ribersborg",
    description:
      "Family-ready townhouse with a private patio, renovated kitchen, and quick access to the waterfront promenade.",
    listing_type: "sale",
    property_type: "townhouse",
    status: "published",
    price_amount: 8950000,
    currency: "SEK",
    city: "Malmo",
    region: "Skane",
    address: "Sergels vag 12",
    latitude: 55.6003,
    longitude: 12.9674,
    rooms: 5,
    living_area: 142,
    monthly_fee: 0,
    energy_class: "B",
    amenities: ["Patio", "Fireplace", "Parking"],
    company: { name: "Sund Real Estate", city: "Malmo", verified: true, phone: "+46 40 88 20 10" },
    images: [
      {
        public_url:
          "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
        alt_text: "Warm townhouse exterior",
      },
    ],
  },
  {
    id: "demo-gothenburg-harbor",
    title: "Harbor-view rental in Eriksberg",
    description:
      "A furnished rental with water views, smart storage, and a generous balcony for long Nordic evenings.",
    listing_type: "rent",
    property_type: "apartment",
    status: "published",
    price_amount: 21900,
    currency: "SEK",
    city: "Gothenburg",
    region: "Vastra Gotaland",
    address: "Monsungatan 64",
    latitude: 57.7061,
    longitude: 11.9133,
    rooms: 2,
    living_area: 62,
    monthly_fee: 0,
    energy_class: "A",
    amenities: ["Water view", "Furnished", "Balcony"],
    company: { name: "Nordic Lettings", city: "Gothenburg", verified: false, phone: "+46 31 19 84 00" },
    images: [
      {
        public_url:
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        alt_text: "Modern apartment balcony",
      },
    ],
  },
];

const initialState = {
  route: { name: "browse", params: {}, query: new URLSearchParams() },
  session: null,
  user: null,
  profile: null,
  filters: {
    query: "",
    city: "",
    listingType: "all",
    propertyType: "all",
    maxPrice: "",
    minRooms: "",
  },
  listings: [],
  demoMode: false,
  selectedListing: null,
  favorites: [],
  favoriteIds: new Set(),
  companies: [],
  userListings: [],
  payments: [],
  successStatus: null,
  loading: {
    boot: true,
    listings: false,
    detail: false,
    account: false,
    action: false,
  },
  errors: {},
  notice: null,
};

let state = { ...initialState };
const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

export function setRoute(route) {
  setState({ route });
}

export function setLoading(key, value) {
  setState({ loading: { ...state.loading, [key]: value } });
}

export function setError(key, value) {
  setState({ errors: { ...state.errors, [key]: value } });
}

export function clearError(key) {
  const next = { ...state.errors };
  delete next[key];
  setState({ errors: next });
}

export function setNotice(message, tone = "success") {
  setState({ notice: message ? { message, tone } : null });
}

export function setAuth(session, profile = state.profile) {
  setState({
    session,
    user: session ? session.user : null,
    profile: session ? profile : null,
  });
}

export function setListings(listings, demoMode = false) {
  setState({ listings, demoMode });
}

export function setFavorites(favorites) {
  const favoriteIds = new Set(favorites.map((favorite) => favorite.listing_id || favorite.id));
  setState({ favorites, favoriteIds });
}

export function updateFilters(filters) {
  setState({ filters: { ...state.filters, ...filters } });
}

export function selectDemoListing(id) {
  return DEMO_LISTINGS.find((listing) => listing.id === id) || null;
}
