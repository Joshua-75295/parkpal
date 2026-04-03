import API from "./api.js";
import { API_BASE_URL } from "../utils/constants.js";

const EARTH_RADIUS_KM = 6371;
const API_ORIGIN = new URL(API_BASE_URL).origin;
const MAX_PARKING_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const GEOLOCATION_ERROR_CODES = Object.freeze({
  permissionDenied: 1,
  positionUnavailable: 2,
  timeout: 3,
});
const isSecureBrowserContext =
  typeof window === "undefined" ? true : window.isSecureContext;
const PARKING_PREVIEW_PALETTES = [
  {
    backgroundStart: "#dff4ff",
    backgroundEnd: "#f2fce2",
    accent: "#0f766e",
    accentSoft: "#99f6e4",
    ink: "#102a43",
  },
  {
    backgroundStart: "#fef3c7",
    backgroundEnd: "#fee2e2",
    accent: "#b45309",
    accentSoft: "#fcd34d",
    ink: "#78350f",
  },
  {
    backgroundStart: "#e0f2fe",
    backgroundEnd: "#ede9fe",
    accent: "#1d4ed8",
    accentSoft: "#93c5fd",
    ink: "#1e3a8a",
  },
  {
    backgroundStart: "#dcfce7",
    backgroundEnd: "#e0f2fe",
    accent: "#166534",
    accentSoft: "#86efac",
    ink: "#14532d",
  },
];

export const getLocationText = (slot) =>
  typeof slot.location === "string" ? slot.location : slot.location?.address ?? "";

export const resolveParkingImageUrl = (imageUrl) => {
  if (!imageUrl) {
    return "";
  }

  if (
    /^https?:\/\//i.test(imageUrl) ||
    imageUrl.startsWith("//") ||
    imageUrl.startsWith("data:")
  ) {
    return imageUrl;
  }

  try {
    return new URL(imageUrl, `${API_ORIGIN}/`).toString();
  } catch {
    return imageUrl;
  }
};

const escapeSvgText = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const truncatePreviewText = (value, maxLength = 34) => {
  const normalizedValue = String(value ?? "").trim();

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`;
};

const hashPreviewSeed = (value) =>
  Array.from(String(value ?? "")).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0
  );

const buildSpotSummary = (slot) => {
  const totalSpots = Number(slot?.totalActiveSpots ?? slot?.availableSlots ?? 0);
  const vipSpots = Number(slot?.allocationConfig?.vipSpotCount ?? 0) || 0;
  const accessibleSpots =
    Number(slot?.allocationConfig?.accessibleSpotCount ?? 0) || 0;
  const standardSpots = Math.max(totalSpots - vipSpots - accessibleSpots, 0);
  const summaryParts = [];

  if (standardSpots > 0) {
    summaryParts.push(`${standardSpots} standard`);
  }

  if (vipSpots > 0) {
    summaryParts.push(`${vipSpots} VIP`);
  }

  if (accessibleSpots > 0) {
    summaryParts.push(`${accessibleSpots} accessible`);
  }

  if (summaryParts.length === 0 && totalSpots > 0) {
    summaryParts.push(`${totalSpots} total spots`);
  }

  return summaryParts.join(" • ");
};

const buildParkingPreviewDataUrl = (slot = {}) => {
  const seed = slot.title || getLocationText(slot) || "ParkPal";
  const palette =
    PARKING_PREVIEW_PALETTES[
      hashPreviewSeed(seed) % PARKING_PREVIEW_PALETTES.length
    ];
  const title = truncatePreviewText(slot.title || "Parking Slot", 30);
  const subtitle = truncatePreviewText(getLocationText(slot) || "Smart parking", 44);
  const topLabel = Number(slot.pricePerHour) > 0 ? `Rs. ${slot.pricePerHour}/hour` : "ParkPal";
  const summary = truncatePreviewText(buildSpotSummary(slot) || "Ready for parking", 42);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" role="img" aria-label="${escapeSvgText(title)}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette.backgroundStart}" />
          <stop offset="100%" stop-color="${palette.backgroundEnd}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="700" rx="44" fill="url(#bg)" />
      <circle cx="1030" cy="96" r="110" fill="${palette.accentSoft}" opacity="0.45" />
      <circle cx="110" cy="580" r="130" fill="${palette.accentSoft}" opacity="0.3" />
      <rect x="72" y="72" width="1056" height="556" rx="36" fill="#ffffff" opacity="0.62" />
      <rect x="112" y="132" width="270" height="344" rx="32" fill="${palette.accent}" />
      <text x="247" y="330" fill="#ffffff" font-size="180" font-family="Georgia, serif" text-anchor="middle" font-weight="700">P</text>
      <path d="M474 470h562" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.85" />
      <path d="M474 510h562" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.55" />
      <path d="M474 550h562" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.35" />
      <text x="474" y="190" fill="${palette.ink}" font-size="38" font-family="Arial, sans-serif" font-weight="700">${escapeSvgText(topLabel)}</text>
      <text x="474" y="278" fill="${palette.ink}" font-size="72" font-family="Georgia, serif" font-weight="700">${escapeSvgText(title)}</text>
      <text x="474" y="344" fill="${palette.ink}" font-size="34" font-family="Arial, sans-serif">${escapeSvgText(subtitle)}</text>
      <text x="474" y="402" fill="${palette.ink}" font-size="28" font-family="Arial, sans-serif">${escapeSvgText(summary)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg.replace(/\s{2,}/g, " ").trim()
  )}`;
};

export const getParkingPreviewImageUrl = (slot = {}) =>
  resolveParkingImageUrl(slot.imageUrl) || buildParkingPreviewDataUrl(slot);

export const hasSlotCoordinates = (slot) =>
  Number.isFinite(Number(slot?.location?.lat)) &&
  Number.isFinite(Number(slot?.location?.lng));

export const getSlotCoordinates = (slot) =>
  hasSlotCoordinates(slot)
    ? [Number(slot.location.lat), Number(slot.location.lng)]
    : null;

const toRadians = (value) => (value * Math.PI) / 180;

export const getDistanceBetweenCoordinatesKm = (origin, destination) => {
  if (
    !origin ||
    !destination ||
    !Number.isFinite(Number(origin.lat)) ||
    !Number.isFinite(Number(origin.lng)) ||
    !Number.isFinite(Number(destination.lat)) ||
    !Number.isFinite(Number(destination.lng))
  ) {
    return null;
  }

  const latDelta = toRadians(Number(destination.lat) - Number(origin.lat));
  const lngDelta = toRadians(Number(destination.lng) - Number(origin.lng));
  const originLat = toRadians(Number(origin.lat));
  const destinationLat = toRadians(Number(destination.lat));
  const haversineValue =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(lngDelta / 2) ** 2;
  const arc = 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));

  return Number((EARTH_RADIUS_KM * arc).toFixed(2));
};

export const enrichSlotWithDistance = (slot, userLocation) => {
  if (!userLocation || !hasSlotCoordinates(slot)) {
    return slot;
  }

  const [lat, lng] = getSlotCoordinates(slot);
  const distanceFromUserKm = getDistanceBetweenCoordinatesKm(userLocation, {
    lat,
    lng,
  });

  return {
    ...slot,
    distanceFromUserKm,
  };
};

export const enrichSlotsWithDistance = (slots, userLocation) =>
  slots.map((slot) => enrichSlotWithDistance(slot, userLocation));

export const sortSlotsByDistance = (slots) =>
  [...slots].sort((leftSlot, rightSlot) => {
    const leftDistance = Number(leftSlot.distanceFromUserKm);
    const rightDistance = Number(rightSlot.distanceFromUserKm);
    const leftHasDistance = Number.isFinite(leftDistance);
    const rightHasDistance = Number.isFinite(rightDistance);

    if (leftHasDistance && rightHasDistance) {
      return leftDistance - rightDistance || leftSlot.pricePerHour - rightSlot.pricePerHour;
    }

    if (leftHasDistance) {
      return -1;
    }

    if (rightHasDistance) {
      return 1;
    }

    return 0;
  });

export const formatDistanceAway = (distanceKm) => {
  const normalizedDistance = Number(distanceKm);

  if (!Number.isFinite(normalizedDistance)) {
    return "";
  }

  if (normalizedDistance < 1) {
    return `${Math.round(normalizedDistance * 1000)} m away`;
  }

  return `${normalizedDistance.toFixed(normalizedDistance < 10 ? 1 : 0)} km away`;
};

const requestCurrentPosition = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const getGeolocationPermissionState = async () => {
  if (
    typeof navigator === "undefined" ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== "function"
  ) {
    return "";
  }

  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result?.state ?? "";
  } catch {
    return "";
  }
};

const buildLocationErrorMessage = async (error) => {
  const permissionState = await getGeolocationPermissionState();

  if (!isSecureBrowserContext) {
    return "Location works only in a secure context. Use localhost or HTTPS and try again.";
  }

  switch (error?.code) {
    case GEOLOCATION_ERROR_CODES.permissionDenied:
      if (permissionState === "granted") {
        return "Location is allowed in the browser, but your device is still blocking it. Turn on system location services and allow your browser to use them.";
      }

      return "Location access was blocked. Allow location for this site and make sure your device location services are enabled.";
    case GEOLOCATION_ERROR_CODES.positionUnavailable:
      return "Your device could not determine a location right now. Check GPS or network-based location and try again.";
    case GEOLOCATION_ERROR_CODES.timeout:
      return "Location lookup timed out. Try again in a spot with better signal or internet access.";
    default:
      return (
        error?.message ||
        "Could not read your current location. Check browser permissions and try again."
      );
  }
};

export const requestBrowserLocation = async () => {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location services are not available in this browser.");
  }

  if (!isSecureBrowserContext) {
    throw new Error(
      "Location works only in a secure context. Use localhost or HTTPS and try again."
    );
  }

  const locationRequestOptions = [
    {
      enableHighAccuracy: true,
      maximumAge: 60 * 1000,
      timeout: 10 * 1000,
    },
    {
      enableHighAccuracy: false,
      maximumAge: 5 * 60 * 1000,
      timeout: 15 * 1000,
    },
  ];

  let lastError = null;

  for (const options of locationRequestOptions) {
    try {
      const position = await requestCurrentPosition(options);

      return {
        lat: Number(position.coords.latitude),
        lng: Number(position.coords.longitude),
      };
    } catch (error) {
      lastError = error;

      if (
        error?.code !== GEOLOCATION_ERROR_CODES.timeout &&
        error?.code !== GEOLOCATION_ERROR_CODES.positionUnavailable
      ) {
        break;
      }
    }
  }

  throw new Error(await buildLocationErrorMessage(lastError));
};

export const readImageFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    if (!file.type?.startsWith("image/")) {
      reject(new Error("Select a valid image file."));
      return;
    }

    if (file.size > MAX_PARKING_IMAGE_SIZE_BYTES) {
      reject(new Error("Parking image must be 5 MB or smaller."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not process the selected image."));
    };

    reader.onerror = () => {
      reject(new Error("Could not read the selected image file."));
    };

    reader.readAsDataURL(file);
  });

export const getParkingSlots = async (filters = {}) => {
  const trimmedLocation = filters.location?.trim() ?? "";
  const hasTimeRange = Boolean(filters.startTime && filters.endTime);
  const params = {};

  if (hasTimeRange) {
    params.startTime = filters.startTime;
    params.endTime = filters.endTime;
  } else {
    if (trimmedLocation) {
      params.location = trimmedLocation;
    }

    if (filters.minPrice !== "") {
      params.minPrice = filters.minPrice;
    }

    if (filters.maxPrice !== "") {
      params.maxPrice = filters.maxPrice;
    }
  }

  const response = await API.get(hasTimeRange ? "/parking/available" : "/parking", {
    params,
  });

  const slots = Array.isArray(response.data) ? response.data : [];

  if (!hasTimeRange) {
    return slots;
  }

  return slots.filter((slot) => {
    const price = Number(slot.pricePerHour) || 0;
    const matchesLocation = !trimmedLocation
      ? true
      : getLocationText(slot).toLowerCase().includes(trimmedLocation.toLowerCase());
    const matchesMinPrice =
      filters.minPrice === "" ? true : price >= Number(filters.minPrice);
    const matchesMaxPrice =
      filters.maxPrice === "" ? true : price <= Number(filters.maxPrice);

    return matchesLocation && matchesMinPrice && matchesMaxPrice;
  });
};

export const getManagedParkingSlots = async () => {
  const response = await API.get("/parking/my");
  return Array.isArray(response.data) ? response.data : [];
};

const normalizeFavoriteParkingSlotIds = (payload) => {
  const favoriteParkingSlotIds = payload?.favoriteParkingSlotIds;

  return Array.isArray(favoriteParkingSlotIds) ? favoriteParkingSlotIds : [];
};

export const getFavoriteParkingSlotIds = async () => {
  const response = await API.get("/parking/favorites");
  return normalizeFavoriteParkingSlotIds(response.data);
};

export const addFavoriteParkingSlot = async (parkingSlotId) => {
  const response = await API.post(`/parking/${parkingSlotId}/favorite`);
  return normalizeFavoriteParkingSlotIds(response.data);
};

export const removeFavoriteParkingSlot = async (parkingSlotId) => {
  const response = await API.delete(`/parking/${parkingSlotId}/favorite`);
  return normalizeFavoriteParkingSlotIds(response.data);
};

const toParkingPayload = (payload) => ({
  title: payload.title,
  imageUrl: payload.imageUrl ?? "",
  ...(payload.imageData ? { imageData: payload.imageData } : {}),
  location: {
    address: payload.address,
    lat: Number(payload.lat),
    lng: Number(payload.lng),
  },
  pricePerHour: Number(payload.pricePerHour),
  availableSlots: Number(payload.availableSlots),
  allocationConfig: {
    accessibleSpotCount: Number(payload.accessibleSpotCount ?? 0),
    vipSpotCount: Number(payload.vipSpotCount ?? 0),
  },
  status: payload.status ?? "active",
});

export const createParkingSlot = async (payload) => {
  const response = await API.post("/parking", toParkingPayload(payload));

  return response.data.parking ?? response.data;
};

export const updateParkingSlot = async (parkingSlotId, payload) => {
  const response = await API.put(
    `/parking/${parkingSlotId}`,
    toParkingPayload(payload)
  );

  return response.data.parking ?? response.data;
};

export const deleteParkingSlot = async (parkingSlotId) => {
  const response = await API.delete(`/parking/${parkingSlotId}`);
  return response.data;
};
