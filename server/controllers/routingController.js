import { createHttpError } from "../utils/httpError.js";
import {
  computeGoogleRouteMatrix,
  computeGoogleRoutes,
  isGoogleRoutesConfigured,
} from "../utils/googleRoutes.js";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const normalizePoint = (point, label) => {
  if (!point || !isFiniteCoordinate(point.lat) || !isFiniteCoordinate(point.lng)) {
    throw createHttpError(400, `${label} must include numeric lat and lng values.`, {
      code: "INVALID_LOCATION_POINT",
    });
  }

  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
  };
};

const normalizeDestinations = (destinations) => {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw createHttpError(
      400,
      "Provide at least one destination to compute travel times.",
      {
        code: "ROUTING_DESTINATIONS_REQUIRED",
      }
    );
  }

  return destinations.map((destination, index) => ({
    ...normalizePoint(destination, `Destination ${index + 1}`),
    slotId:
      typeof destination?.slotId === "string" && destination.slotId.trim()
        ? destination.slotId.trim()
        : `destination-${index + 1}`,
  }));
};

export const routingControllerDependencies = {
  computeGoogleRouteMatrix,
  computeGoogleRoutes,
  isGoogleRoutesConfigured,
};

const ensureGoogleRoutingConfigured = () => {
  if (routingControllerDependencies.isGoogleRoutesConfigured()) {
    return;
  }

  throw createHttpError(
    503,
    "Google routing is not configured on this server yet.",
    {
      code: "GOOGLE_ROUTING_UNAVAILABLE",
    }
  );
};

export const computeTravelMatrix = async (req, res) => {
  ensureGoogleRoutingConfigured();

  const origin = normalizePoint(req.body?.origin, "Origin");
  const destinations = normalizeDestinations(req.body?.destinations);
  const departureTime =
    typeof req.body?.departureTime === "string" && req.body.departureTime.trim()
      ? req.body.departureTime
      : new Date().toISOString();
  const matrixRows = await routingControllerDependencies.computeGoogleRouteMatrix({
    departureTime,
    destinations,
    origin,
  });
  const metricsBySlotId = {};

  matrixRows.forEach((row) => {
    const destination = destinations[row.destinationIndex];

    if (!destination || row.condition !== "ROUTE_EXISTS") {
      return;
    }

    metricsBySlotId[destination.slotId] = {
      distanceKm: Number.isFinite(row.distanceMeters)
        ? Number((row.distanceMeters / 1000).toFixed(1))
        : null,
      durationMinutes: Number.isFinite(row.durationSeconds)
        ? Math.max(1, Math.round(row.durationSeconds / 60))
        : null,
      provider: "google",
      trafficAware: true,
    };
  });

  return res.json({
    departureTime,
    metricsBySlotId,
    provider: "google",
    trafficAware: true,
  });
};

export const computeTravelRoutes = async (req, res) => {
  ensureGoogleRoutingConfigured();

  const origin = normalizePoint(req.body?.origin, "Origin");
  const destination = normalizePoint(req.body?.destination, "Destination");
  const departureTime =
    typeof req.body?.departureTime === "string" && req.body.departureTime.trim()
      ? req.body.departureTime
      : new Date().toISOString();
  const routes = await routingControllerDependencies.computeGoogleRoutes({
    departureTime,
    destination,
    origin,
  });

  return res.json({
    departureTime,
    provider: "google",
    routes,
    trafficAware: true,
  });
};
