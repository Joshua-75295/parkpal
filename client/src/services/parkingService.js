import API from "./api.js";
import { API_BASE_URL } from "../utils/constants.js";

const EARTH_RADIUS_KM = 6371;
const API_ORIGIN = new URL(API_BASE_URL).origin;
const MAX_PARKING_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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

export const requestBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location services are not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        });
      },
      (error) => {
        reject(
          new Error(
            error?.message ||
              "Could not read your current location. Check browser permissions and try again."
          )
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60 * 1000,
        timeout: 10 * 1000,
      }
    );
  });

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
