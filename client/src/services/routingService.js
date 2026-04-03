import API from "./api.js";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
} from "../utils/constants.js";
import { hasSlotCoordinates } from "./parkingService.js";

let googleMapsLoaderPromise = null;

const decodeGooglePolyline = (encodedPolyline = "") => {
  const coordinates = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encodedPolyline.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      lat: latitude / 1e5,
      lng: longitude / 1e5,
    });
  }

  return coordinates;
};

export const isGoogleMapsConfigured = () =>
  Boolean(GOOGLE_MAPS_API_KEY.trim());

export const getGoogleMapsMapId = () => GOOGLE_MAPS_MAP_ID.trim();

export const loadGoogleMapsApi = async () => {
  if (typeof window === "undefined") {
    throw new Error("Google Maps can only load in the browser.");
  }

  if (window.google?.maps) {
    return window.google;
  }

  if (!isGoogleMapsConfigured()) {
    throw new Error("Google Maps is not configured for this client.");
  }

  if (!googleMapsLoaderPromise) {
    googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[data-google-maps-loader="parkpal"]'
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.google), {
          once: true,
        });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Could not load Google Maps.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      const scriptUrl = new URL("https://maps.googleapis.com/maps/api/js");

      scriptUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY.trim());
      scriptUrl.searchParams.set("loading", "async");
      scriptUrl.searchParams.set("v", "weekly");
      script.async = true;
      script.dataset.googleMapsLoader = "parkpal";
      script.defer = true;
      script.src = scriptUrl.toString();
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error("Could not load Google Maps."));

      document.head.appendChild(script);
    });
  }

  return googleMapsLoaderPromise;
};

export const fetchGoogleTravelMetricsForSlots = async (
  slots,
  userLocation,
  { signal } = {}
) => {
  const destinations = slots
    .filter(hasSlotCoordinates)
    .map((slot) => ({
      lat: Number(slot.location.lat),
      lng: Number(slot.location.lng),
      slotId: slot._id,
    }));

  if (!destinations.length) {
    return {};
  }

  const response = await API.post(
    "/routing/matrix",
    {
      destinations,
      origin: {
        lat: Number(userLocation.lat),
        lng: Number(userLocation.lng),
      },
    },
    { signal }
  );

  return response.data?.metricsBySlotId ?? {};
};

export const fetchGoogleAlternativeRoutes = async (
  origin,
  destination,
  { signal } = {}
) => {
  const response = await API.post(
    "/routing/routes",
    {
      destination: {
        lat: Number(destination.lat),
        lng: Number(destination.lng),
      },
      origin: {
        lat: Number(origin.lat),
        lng: Number(origin.lng),
      },
    },
    { signal }
  );
  const routes = Array.isArray(response.data?.routes) ? response.data.routes : [];

  return routes.map((route, index) => ({
    ...route,
    coordinates: decodeGooglePolyline(route.encodedPolyline),
    label: route.label || (index === 0 ? "Best ETA" : `Alt ${index + 1}`),
    provider: "google",
    trafficAware: true,
  }));
};
