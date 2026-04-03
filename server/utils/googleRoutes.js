const GOOGLE_ROUTES_API_BASE_URL = "https://routes.googleapis.com";
const GOOGLE_ROUTES_MATRIX_BATCH_SIZE = 100;
const GOOGLE_TRAFFIC_ROUTING_PREFERENCE = "TRAFFIC_AWARE_OPTIMAL";

const chunkItems = (items, chunkSize) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const toLatLng = (point) => ({
  latitude: Number(point.lat),
  longitude: Number(point.lng),
});

const toWaypoint = (point) => ({
  location: {
    latLng: toLatLng(point),
  },
});

const parseDurationSeconds = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue.endsWith("s")) {
    return null;
  }

  const seconds = Number(normalizedValue.slice(0, -1));

  return Number.isFinite(seconds) ? seconds : null;
};

const createGoogleRoutesUrl = (pathname) =>
  `${GOOGLE_ROUTES_API_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;

const requestGoogleRoutes = async (pathname, payload, fieldMask) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing.");
  }

  const response = await fetch(createGoogleRoutesUrl(pathname), {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Google routing request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
    );
  }

  return response.json();
};

const getRouteDisplayLabel = (routeLabels = [], index = 0) => {
  if (routeLabels.includes("DEFAULT_ROUTE")) {
    return "Best ETA";
  }

  if (routeLabels.includes("DEFAULT_ROUTE_ALTERNATE")) {
    return `Alt ${index + 1}`;
  }

  return index === 0 ? "Best ETA" : `Alt ${index + 1}`;
};

export const isGoogleRoutesConfigured = () =>
  Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());

export const computeGoogleRouteMatrix = async ({
  departureTime = new Date().toISOString(),
  destinations = [],
  origin,
}) => {
  const results = [];

  for (const [batchIndex, destinationBatch] of chunkItems(
    destinations,
    GOOGLE_ROUTES_MATRIX_BATCH_SIZE
  ).entries()) {
    const payload = {
      departureTime,
      destinations: destinationBatch.map((destination) => ({
        waypoint: toWaypoint(destination),
      })),
      origins: [
        {
          waypoint: toWaypoint(origin),
        },
      ],
      routingPreference: GOOGLE_TRAFFIC_ROUTING_PREFERENCE,
      travelMode: "DRIVE",
      units: "METRIC",
    };
    const matrixRows = await requestGoogleRoutes(
      "/distanceMatrix/v2:computeRouteMatrix",
      payload,
      "originIndex,destinationIndex,duration,distanceMeters,condition"
    );

    results.push(
      ...matrixRows.map((row) => ({
        condition: row.condition ?? "ROUTE_EXISTS",
        destinationIndex:
          Number(row.destinationIndex) +
          batchIndex * GOOGLE_ROUTES_MATRIX_BATCH_SIZE,
        distanceMeters: Number.isFinite(Number(row.distanceMeters))
          ? Number(row.distanceMeters)
          : null,
        durationSeconds: parseDurationSeconds(row.duration),
      }))
    );
  }

  return results;
};

export const computeGoogleRoutes = async ({
  departureTime = new Date().toISOString(),
  destination,
  origin,
}) => {
  const payload = {
    computeAlternativeRoutes: true,
    departureTime,
    destination: {
      location: {
        latLng: toLatLng(destination),
      },
    },
    origin: {
      location: {
        latLng: toLatLng(origin),
      },
    },
    routingPreference: GOOGLE_TRAFFIC_ROUTING_PREFERENCE,
    travelMode: "DRIVE",
    units: "METRIC",
  };
  const response = await requestGoogleRoutes(
    "/directions/v2:computeRoutes",
    payload,
    "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.routeLabels"
  );
  const routes = Array.isArray(response?.routes) ? response.routes : [];

  return routes.map((route, index) => {
    const distanceMeters = Number(route.distanceMeters);
    const durationSeconds = parseDurationSeconds(route.duration);

    return {
      distanceKm: Number.isFinite(distanceMeters)
        ? Number((distanceMeters / 1000).toFixed(1))
        : null,
      durationMinutes: Number.isFinite(durationSeconds)
        ? Math.max(1, Math.round(durationSeconds / 60))
        : null,
      encodedPolyline: route?.polyline?.encodedPolyline ?? "",
      id: `google-route-${index + 1}`,
      label: getRouteDisplayLabel(route.routeLabels ?? [], index),
      routeLabels: Array.isArray(route.routeLabels) ? route.routeLabels : [],
    };
  });
};
