import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import ParkingMap from "../components/ParkingMap.jsx";
import ParkingSlotCard from "../components/ParkingSlotCard.jsx";
import Toast from "../components/Toast.jsx";
import { createBooking } from "../services/bookingService.js";
import { getApiErrorMessage } from "../services/api.js";
import {
  addFavoriteParkingSlot,
  enrichSlotsWithDistance,
  fetchDrivingRoute,
  fetchRoadMetricsForSlots,
  formatTravelDistance,
  formatTravelSummary,
  formatTravelDuration,
  getFavoriteParkingSlotIds,
  getParkingSlots,
  hasSlotCoordinates,
  removeFavoriteParkingSlot,
  requestBrowserLocation,
  sortSlotsByDistance,
} from "../services/parkingService.js";
import {
  fetchGoogleAlternativeRoutes,
  fetchGoogleTravelMetricsForSlots,
  isGoogleMapsConfigured,
} from "../services/routingService.js";
import {
  REALTIME_EVENTS,
  subscribeToRealtimeEvent,
} from "../services/realtimeService.js";
import { formatDateTime } from "../utils/formatDate.js";

const initialFilters = {
  location: "",
  minPrice: "",
  maxPrice: "",
  startTime: "",
  endTime: "",
};

const pageStyle = {
  display: "grid",
  gap: "18px",
  padding: "clamp(22px, 4vw, 36px) 0 20px",
};

const heroStyle = {
  display: "grid",
  gap: "10px",
};

const filterCardStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "18px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  boxShadow: "0 18px 40px rgba(16, 42, 67, 0.08)",
};

const filterGridStyle = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const labelStyle = {
  display: "grid",
  gap: "8px",
  color: "#334e68",
  fontWeight: 600,
  fontSize: "0.95rem",
};

const inputStyle = {
  border: "1px solid #bcccdc",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "0.95rem",
  background: "#f8fbfd",
};

const buttonRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const primaryButtonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  background: "#134e4a",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  border: "1px solid rgba(16, 42, 67, 0.12)",
  borderRadius: "12px",
  padding: "12px 16px",
  background: "#ffffff",
  color: "#102a43",
  fontWeight: 700,
  cursor: "pointer",
};

const mapPanelStyle = {
  display: "grid",
  gap: "12px",
};

const listPanelStyle = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  alignItems: "start",
};

const summaryGridStyle = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};

const summaryCardStyle = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "14px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  boxShadow: "0 18px 40px rgba(16, 42, 67, 0.06)",
};

const statusRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: "14px",
};

const statusBadgeStyle = {
  borderRadius: "999px",
  padding: "7px 12px",
  background: "rgba(59, 130, 246, 0.12)",
  color: "#1d4ed8",
  fontWeight: 700,
  fontSize: "0.9rem",
};

const statusTextStyle = {
  margin: 0,
  color: "#486581",
  lineHeight: 1.6,
};

const sectionHeadingStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap",
};

const sectionEyebrowStyle = {
  margin: 0,
  color: "#486581",
  lineHeight: 1.6,
};

const resultsCountStyle = {
  borderRadius: "999px",
  padding: "8px 12px",
  background: "rgba(15, 118, 110, 0.12)",
  color: "#0f766e",
  fontWeight: 700,
  fontSize: "0.9rem",
};

function SearchPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const supportsGoogleMaps = isGoogleMapsConfigured();
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [slots, setSlots] = useState([]);
  const [bookingData, setBookingData] = useState({});
  const [favoriteParkingSlotIds, setFavoriteParkingSlotIds] = useState([]);
  const [hasHandledRebookRequest, setHasHandledRebookRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRouting, setIsRouting] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState("");
  const [activeFavoriteId, setActiveFavoriteId] = useState("");
  const [activeRouteId, setActiveRouteId] = useState("");
  const [roadMetricsBySlotId, setRoadMetricsBySlotId] = useState({});
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isNearestMode, setIsNearestMode] = useState(false);
  const [toast, setToast] = useState(null);
  const rebookRequest = routerLocation.state?.rebookRequest ?? null;

  const hasRoadDistances = useMemo(
    () => Object.keys(roadMetricsBySlotId).length > 0,
    [roadMetricsBySlotId]
  );
  const hasTrafficAwareMetrics = useMemo(
    () =>
      Object.values(roadMetricsBySlotId).some(
        (metric) => metric?.trafficAware === true
      ),
    [roadMetricsBySlotId]
  );

  const loadSlots = useCallback(async (nextFilters) => {
    setIsLoading(true);
    const requestedFilters = {
      ...initialFilters,
      ...nextFilters,
    };

    try {
      const parkingSlots = await getParkingSlots(requestedFilters);
      setSlots(parkingSlots);
      setAppliedFilters(requestedFilters);
      return parkingSlots;
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Search unavailable",
        message: getApiErrorMessage(requestError, "Could not load parking slots."),
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rebookRequest?.parkingSlotId || hasHandledRebookRequest) {
      return;
    }

    loadSlots(initialFilters);
  }, [hasHandledRebookRequest, loadSlots, rebookRequest]);

  const loadFavoriteSlots = useCallback(async () => {
    try {
      const favoriteSlotIds = await getFavoriteParkingSlotIds();
      setFavoriteParkingSlotIds(favoriteSlotIds);
    } catch (requestError) {
      setToast((currentToast) =>
        currentToast ?? {
          type: "error",
          title: "Saved slots unavailable",
          message: getApiErrorMessage(
            requestError,
            "Could not load your saved parking slots."
          ),
        }
      );
    }
  }, []);

  useEffect(() => {
    loadFavoriteSlots().catch(() => null);
  }, [loadFavoriteSlots]);

  const loadRoadMetricsForLocation = useCallback(
    async (location, { showFallbackToast = false, signal } = {}) => {
      if (!location) {
        setRoadMetricsBySlotId({});
        return {};
      }

      const loadOsrmFallbackMetrics = async () => {
        const nextRoadMetrics = await fetchRoadMetricsForSlots(slots, location, {
          signal,
        });

        setRoadMetricsBySlotId(nextRoadMetrics);
        return nextRoadMetrics;
      };

      try {
        const nextRoadMetrics = supportsGoogleMaps
          ? await fetchGoogleTravelMetricsForSlots(slots, location, { signal })
          : await loadOsrmFallbackMetrics();

        setRoadMetricsBySlotId(nextRoadMetrics);
        return nextRoadMetrics;
      } catch (requestError) {
        if (requestError?.name === "AbortError") {
          throw requestError;
        }

        if (supportsGoogleMaps) {
          try {
            const fallbackMetrics = await loadOsrmFallbackMetrics();

            if (showFallbackToast) {
              setToast((currentToast) =>
                currentToast ?? {
                  type: "info",
                  title: "Google traffic ETA unavailable",
                  message:
                    "Using standard road routing for now. Add a Google Routes API key on the server for traffic-aware ETA and alternate routes.",
                }
              );
            }

            return fallbackMetrics;
          } catch (fallbackError) {
            if (fallbackError?.name === "AbortError") {
              throw fallbackError;
            }
          }
        }

        setRoadMetricsBySlotId({});

        if (showFallbackToast) {
          setToast((currentToast) =>
            currentToast ?? {
              type: "info",
              title: "Routing unavailable",
              message:
                "Using approximate straight-line distance until route data is available again.",
            }
          );
        }

        return {};
      }
    },
    [slots, supportsGoogleMaps]
  );

  useEffect(() => {
    if (!userLocation) {
      setRoadMetricsBySlotId({});
      return;
    }

    const abortController = new AbortController();

    loadRoadMetricsForLocation(userLocation, {
      showFallbackToast: true,
      signal: abortController.signal,
    }).catch(() => null);

    return () => {
      abortController.abort();
    };
  }, [loadRoadMetricsForLocation, userLocation]);

  const slotsWithDistance = useMemo(
    () => enrichSlotsWithDistance(slots, userLocation, roadMetricsBySlotId),
    [roadMetricsBySlotId, slots, userLocation]
  );

  const distanceSortedSlots = useMemo(
    () => sortSlotsByDistance(slotsWithDistance),
    [slotsWithDistance]
  );

  const displaySlots = useMemo(
    () => (isNearestMode ? distanceSortedSlots : slotsWithDistance),
    [distanceSortedSlots, isNearestMode, slotsWithDistance]
  );

  const nearestMappedSlot = useMemo(
    () =>
      distanceSortedSlots.find(
        (slot) =>
          hasSlotCoordinates(slot) && slot.distanceFromUserKm != null
      ) ?? null,
    [distanceSortedSlots]
  );

  const favoriteParkingSlotIdSet = useMemo(
    () => new Set(favoriteParkingSlotIds),
    [favoriteParkingSlotIds]
  );

  const displaySlotsWithFavorites = useMemo(
    () =>
      displaySlots.map((slot) => ({
        ...slot,
        isFavorite: favoriteParkingSlotIdSet.has(slot._id),
      })),
    [displaySlots, favoriteParkingSlotIdSet]
  );
  useEffect(() => {
    if (!userLocation) {
      setRouteOptions([]);
      setActiveRouteId("");
      setIsRouting(false);
      return;
    }

    const selectedSlot = displaySlots.find((slot) => slot._id === selectedSlotId);

    if (!selectedSlot || !hasSlotCoordinates(selectedSlot)) {
      setRouteOptions([]);
      setActiveRouteId("");
      setIsRouting(false);
      return;
    }

    const abortController = new AbortController();

    setIsRouting(true);

    const loadRouteOptions = async () => {
      try {
        const nextRoutes = supportsGoogleMaps
          ? await fetchGoogleAlternativeRoutes(userLocation, selectedSlot.location, {
              signal: abortController.signal,
            })
          : [];

        if (nextRoutes.length) {
          setRouteOptions(nextRoutes);
          setActiveRouteId((currentRouteId) =>
            nextRoutes.some((route) => route.id === currentRouteId)
              ? currentRouteId
              : nextRoutes[0].id
          );
          return;
        }

        const fallbackRoute = await fetchDrivingRoute(userLocation, selectedSlot.location, {
          signal: abortController.signal,
        });

        if (!fallbackRoute) {
          setRouteOptions([]);
          setActiveRouteId("");
          return;
        }

        const nextFallbackRoutes = [
          {
            ...fallbackRoute,
            id: "fallback-route-1",
            label: supportsGoogleMaps ? "Road fallback" : "Road route",
            provider: supportsGoogleMaps ? "osrm" : "leaflet",
            trafficAware: false,
          },
        ];

        setRouteOptions(nextFallbackRoutes);
        setActiveRouteId(nextFallbackRoutes[0].id);
      } catch (requestError) {
        if (requestError?.name === "AbortError") {
          return;
        }

        setRouteOptions([]);
        setActiveRouteId("");

        if (supportsGoogleMaps) {
          setToast((currentToast) =>
            currentToast ?? {
              type: "info",
              title: "Route alternatives unavailable",
              message:
                "Google route options could not be loaded, so the map is falling back to the basic route preview.",
            }
          );
        }
      }
    };

    loadRouteOptions()
      .catch((requestError) => {
        if (requestError?.name === "AbortError") {
          return;
        }

        setRouteOptions([]);
        setActiveRouteId("");
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsRouting(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [displaySlots, selectedSlotId, supportsGoogleMaps, userLocation]);

  useEffect(() => {
    const unsubscribeInventory = subscribeToRealtimeEvent(
      REALTIME_EVENTS.inventoryChanged,
      () => {
        loadSlots(appliedFilters).catch(() => null);
      }
    );

    const unsubscribeAvailability = subscribeToRealtimeEvent(
      REALTIME_EVENTS.availabilityChanged,
      () => {
        if (appliedFilters.startTime && appliedFilters.endTime) {
          loadSlots(appliedFilters).catch(() => null);
        }
      }
    );

    return () => {
      unsubscribeInventory();
      unsubscribeAvailability();
    };
  }, [appliedFilters, loadSlots]);

  useEffect(() => {
    if (!rebookRequest?.parkingSlotId) {
      return;
    }

    setHasHandledRebookRequest(true);
    navigate(routerLocation.pathname, { replace: true, state: null });

    const nextFilters = {
      ...initialFilters,
      startTime: rebookRequest.startTime ?? "",
      endTime: rebookRequest.endTime ?? "",
    };

    setFilters(nextFilters);
    setBookingData((currentBookingData) => ({
      ...currentBookingData,
      [rebookRequest.parkingSlotId]: {
        endTime: rebookRequest.endTime ?? "",
        spotPreference: rebookRequest.spotPreference ?? "nearest",
        startTime: rebookRequest.startTime ?? "",
      },
    }));
    setIsNearestMode(false);

    loadSlots(nextFilters)
      .then((nextSlots) => {
        if (!nextSlots) {
          return;
        }

        const requestedSlot = nextSlots.find(
          (slot) => slot._id === rebookRequest.parkingSlotId
        );

        if (requestedSlot) {
          setSelectedSlotId(rebookRequest.parkingSlotId);
          setToast({
            type: "success",
            title: "Rebook ready",
            message: `${
              rebookRequest.parkingTitle ?? "Your saved parking slot"
            } is prefilled for review.`,
          });
          return;
        }

        setToast({
          type: "info",
          title: "Closest matches loaded",
          message: `${
            rebookRequest.parkingTitle ?? "That parking slot"
          } is not open for the selected time, so we loaded the best available matches instead.`,
        });
      })
      .catch(() => null);
  }, [
    loadSlots,
    navigate,
    rebookRequest,
    routerLocation.pathname,
  ]);

  useEffect(() => {
    if (!displaySlots.length) {
      setSelectedSlotId("");
      return;
    }

    if (
      selectedSlotId &&
      displaySlots.some((slot) => slot._id === selectedSlotId)
    ) {
      return;
    }

    const firstMappedSlot = displaySlots.find(hasSlotCoordinates);
    setSelectedSlotId((firstMappedSlot ?? displaySlots[0])._id);
  }, [displaySlots, selectedSlotId]);

  const summary = useMemo(() => {
    const mappedSlots = displaySlots.filter(hasSlotCoordinates).length;
    const totalCapacity = displaySlots.reduce(
      (runningTotal, slot) =>
        runningTotal +
        Number(slot.availableSpotCount ?? slot.availableSlots ?? 0),
      0
    );
    const savedVisibleSlots = displaySlots.reduce(
      (runningTotal, slot) =>
        runningTotal + (favoriteParkingSlotIdSet.has(slot._id) ? 1 : 0),
      0
    );

    return {
      closestDistance: nearestMappedSlot
        ? formatTravelDistance(
            nearestMappedSlot.distanceFromUserKm,
            nearestMappedSlot.distanceMethod
          )
        : "",
      closestDuration: nearestMappedSlot
        ? formatTravelDuration(nearestMappedSlot.travelDurationMinutes)
        : "",
      closestTitle: nearestMappedSlot?.title ?? "",
      mappedSlots,
      savedVisibleSlots,
      totalCapacity,
      visibleSlots: displaySlots.length,
    };
  }, [displaySlots, favoriteParkingSlotIdSet, nearestMappedSlot]);

  const getBookingValues = (slotId) => ({
    startTime: bookingData[slotId]?.startTime ?? filters.startTime,
    endTime: bookingData[slotId]?.endTime ?? filters.endTime,
    spotPreference: bookingData[slotId]?.spotPreference ?? "nearest",
  });

  const handleFilterChange = (event) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [event.target.name]: event.target.value,
    }));
  };

  const handleBookingChange = (slotId, field, value) => {
    setBookingData((currentBookingData) => ({
      ...currentBookingData,
      [slotId]: {
        ...currentBookingData[slotId],
        [field]: value,
      },
    }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    if (Boolean(filters.startTime) !== Boolean(filters.endTime)) {
      setToast({
        type: "error",
        title: "Incomplete time range",
        message: "Select both start and end time to check live availability.",
      });
      return;
    }

    if (
      filters.startTime &&
      filters.endTime &&
      new Date(filters.startTime) >= new Date(filters.endTime)
    ) {
      setToast({
        type: "error",
        title: "Invalid time range",
        message: "End time must be after the start time.",
      });
      return;
    }

    await loadSlots(filters);
  };

  const resolveUserLocation = useCallback(async () => {
    setIsLocating(true);

    try {
      const location = await requestBrowserLocation();
      setUserLocation(location);
      return location;
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Location unavailable",
        message: requestError.message,
      });
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  const findNearestMappedSlot = useCallback(
    async (location) => {
      const nextRoadMetrics = await loadRoadMetricsForLocation(location, {
        showFallbackToast: true,
      });

      return (
        sortSlotsByDistance(
          enrichSlotsWithDistance(slots, location, nextRoadMetrics)
        ).find(
          (slot) =>
            hasSlotCoordinates(slot) && slot.distanceFromUserKm != null
        ) ?? null
      );
    },
    [loadRoadMetricsForLocation, slots]
  );

  const handleUseMyLocation = async () => {
    const location = await resolveUserLocation();

    if (!location) {
      return;
    }

    loadRoadMetricsForLocation(location, {
      showFallbackToast: true,
    }).catch(() => null);

    setToast({
      type: "success",
      title: "Location ready",
      message:
        supportsGoogleMaps
          ? "Traffic-aware ETA is now live. You can sort results by the fastest parking slot."
          : "Road distance estimates are now live. You can sort results by the nearest parking slot.",
    });
  };

  const handleShowNearestParking = async () => {
    const location = userLocation ?? (await resolveUserLocation());

    if (!location) {
      return;
    }

    const nearestSlot = await findNearestMappedSlot(location);

    if (!nearestSlot) {
      setToast({
        type: "error",
        title: "No mapped slots yet",
        message:
          "These results do not include parking slots with map coordinates, so nearby sorting is unavailable.",
      });
      return;
    }

    setIsNearestMode(true);
    setSelectedSlotId(nearestSlot._id);
    setToast({
      type: "success",
      title: "Nearest parking focused",
      message: `${nearestSlot.title} is the closest mapped option at ${formatTravelSummary(
        nearestSlot.distanceFromUserKm,
        nearestSlot.travelDurationMinutes,
        nearestSlot.distanceMethod
      )}.`,
    });
  };

  const handleClearLocationTools = () => {
    setUserLocation(null);
    setIsNearestMode(false);
    setRouteOptions([]);
    setActiveRouteId("");
  };

  const handleToggleFavorite = async (slotId) => {
    setActiveFavoriteId(slotId);

    try {
      const nextFavoriteParkingSlotIds = favoriteParkingSlotIdSet.has(slotId)
        ? await removeFavoriteParkingSlot(slotId)
        : await addFavoriteParkingSlot(slotId);

      setFavoriteParkingSlotIds(nextFavoriteParkingSlotIds);
      setToast({
        type: "success",
        title: favoriteParkingSlotIdSet.has(slotId)
          ? "Saved slot removed"
          : "Saved slot updated",
        message: favoriteParkingSlotIdSet.has(slotId)
          ? "The parking slot was removed from your saved list."
          : "The parking slot was added to your saved list.",
      });
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Could not update saved slots",
        message: getApiErrorMessage(
          requestError,
          "Could not update your saved parking slots."
        ),
      });
    } finally {
      setActiveFavoriteId("");
    }
  };

  const handleReset = async () => {
    setFilters(initialFilters);
    setBookingData({});
    setIsNearestMode(false);
    setToast(null);
    await loadSlots(initialFilters);
  };

  const handleBooking = async (slotId) => {
    const values = getBookingValues(slotId);

    if (!values.startTime || !values.endTime) {
      setToast({
        type: "error",
        title: "Missing booking time",
        message: "Select both start and end time before booking.",
      });
      return;
    }

    if (new Date(values.startTime) >= new Date(values.endTime)) {
      setToast({
        type: "error",
        title: "Invalid booking window",
        message: "Booking end time must be after the start time.",
      });
      return;
    }

    setActiveBookingId(slotId);
    setSelectedSlotId(slotId);

    try {
      const booking = await createBooking({
        parkingSlotId: slotId,
        startTime: values.startTime,
        endTime: values.endTime,
        spotPreference: values.spotPreference,
      });

      setToast({
        type: "success",
        title: "Booking confirmed",
        message: booking.expiresAt
          ? `Booked ${
              booking.parkingSlot?.title ?? "your parking slot"
            }. Validate by ${formatDateTime(booking.expiresAt)} to keep it active.`
          : `Booked ${booking.parkingSlot?.title ?? "your parking slot"} successfully.`,
      });
      setBookingData((currentBookingData) => ({
        ...currentBookingData,
        [slotId]: {
          startTime: "",
          endTime: "",
          spotPreference: values.spotPreference,
        },
      }));

      await loadSlots(appliedFilters);
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Booking failed",
        message: getApiErrorMessage(requestError, "Booking failed."),
      });
    } finally {
      setActiveBookingId("");
    }
  };

  return (
    <section style={pageStyle}>
      <Toast onDismiss={() => setToast(null)} toast={toast} />

      <div style={heroStyle}>
        <h1 style={{ margin: 0, color: "#102a43" }}>Search Parking Slots</h1>
        <p style={{ margin: 0, color: "#486581", lineHeight: 1.7 }}>
          Filter by location, price, and optionally a live time range. Turn on
          your location to sort by the best route and compare live ETA options
          on the map.
        </p>
      </div>

      <div style={summaryGridStyle}>
        <article style={summaryCardStyle}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
            Visible slots
          </strong>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
            {summary.visibleSlots}
          </span>
        </article>
        <article style={summaryCardStyle}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
            On the map
          </strong>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
            {summary.mappedSlots}
          </span>
        </article>
        <article style={summaryCardStyle}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
            Capacity shown
          </strong>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
            {summary.totalCapacity}
          </span>
        </article>
        {userLocation ? (
          <article style={summaryCardStyle}>
            <strong
              style={{ display: "block", marginBottom: "6px", color: "#486581" }}
            >
              {hasTrafficAwareMetrics
                ? "Fastest ETA"
                : hasRoadDistances
                  ? "Closest by road"
                : "Closest mapped"}
            </strong>
            <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#102a43" }}>
              {hasTrafficAwareMetrics
                ? summary.closestDuration || summary.closestDistance || "Not available"
                : summary.closestDistance || "Not available"}
            </span>
            <p style={{ margin: "8px 0 0", color: "#486581" }}>
              {summary.closestTitle || "No map-ready slots in these results yet."}
              {hasTrafficAwareMetrics
                ? summary.closestDistance
                  ? ` | ${summary.closestDistance}`
                  : ""
                : summary.closestDuration
                  ? ` | ${summary.closestDuration}`
                  : ""}
            </p>
          </article>
        ) : null}
        {favoriteParkingSlotIds.length > 0 ? (
          <article style={summaryCardStyle}>
            <strong
              style={{ display: "block", marginBottom: "6px", color: "#486581" }}
            >
              Saved in view
            </strong>
            <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
              {summary.savedVisibleSlots}
            </span>
            <p style={{ margin: "8px 0 0", color: "#486581" }}>
              {favoriteParkingSlotIds.length} saved slot
              {favoriteParkingSlotIds.length === 1 ? "" : "s"} across your account
            </p>
          </article>
        ) : null}
      </div>

      <form onSubmit={handleSearch} style={filterCardStyle}>
        <div style={filterGridStyle}>
          <label style={labelStyle}>
            Location
            <input
              name="location"
              onChange={handleFilterChange}
              placeholder="Search by area or address"
              style={inputStyle}
              type="text"
              value={filters.location}
            />
          </label>

          <label style={labelStyle}>
            Min price
            <input
              min="0"
              name="minPrice"
              onChange={handleFilterChange}
              placeholder="0"
              style={inputStyle}
              type="number"
              value={filters.minPrice}
            />
          </label>

          <label style={labelStyle}>
            Max price
            <input
              min="0"
              name="maxPrice"
              onChange={handleFilterChange}
              placeholder="500"
              style={inputStyle}
              type="number"
              value={filters.maxPrice}
            />
          </label>

          <label style={labelStyle}>
            Start time
            <input
              name="startTime"
              onChange={handleFilterChange}
              style={inputStyle}
              type="datetime-local"
              value={filters.startTime}
            />
          </label>

          <label style={labelStyle}>
            End time
            <input
              name="endTime"
              onChange={handleFilterChange}
              style={inputStyle}
              type="datetime-local"
              value={filters.endTime}
            />
          </label>
        </div>

        <div style={buttonRowStyle}>
          <button style={primaryButtonStyle} type="submit">
            Search Slots
          </button>
          <button onClick={handleReset} style={secondaryButtonStyle} type="button">
            Reset
          </button>
          <button
            disabled={isLocating}
            onClick={handleUseMyLocation}
            style={secondaryButtonStyle}
            type="button"
          >
            {isLocating
              ? "Locating..."
              : userLocation
                ? "Refresh My Location"
                : "Use My Location"}
          </button>
          <button
            disabled={isLocating}
            onClick={handleShowNearestParking}
            style={secondaryButtonStyle}
            type="button"
          >
            {isNearestMode ? "Nearest First Active" : "Nearest Parking"}
          </button>
          {userLocation ? (
            <button
              onClick={handleClearLocationTools}
              style={secondaryButtonStyle}
              type="button"
            >
              Clear Location Tools
            </button>
          ) : null}
        </div>

        <div style={statusRowStyle}>
          <span style={statusBadgeStyle}>
            {userLocation ? "Location enabled" : "Location off"}
          </span>
          <p style={statusTextStyle}>
            {userLocation
              ? isNearestMode
                ? supportsGoogleMaps
                  ? "Fastest-route sorting is active and the map follows the focused Google-style route."
                  : "Nearest-first sorting is active and the map follows the focused driving route."
                : hasTrafficAwareMetrics
                  ? "Traffic-aware ETA is live. Turn on nearest parking to sort by the fastest route."
                  : hasRoadDistances
                    ? "Road distance estimates are live. Turn on nearest parking to sort the list by real driving distance."
                    : "Approximate distance estimates are live while route data is loading."
              : "Enable location to see how far each slot is from you and jump to the closest mapped option."}
          </p>
        </div>
      </form>

      {isLoading ? <Loader label="Loading parking slots..." /> : null}

      {!isLoading && displaySlots.length === 0 ? (
        <p style={{ color: "#486581" }}>
          No parking slots matched your current search.
        </p>
      ) : null}

      <div style={mapPanelStyle}>
        <div style={sectionHeadingStyle}>
          <div>
            <h2 style={{ margin: "0 0 6px", color: "#102a43" }}>Map First</h2>
            <p style={sectionEyebrowStyle}>
              Start with the map, then browse the parking options in a compact grid below.
            </p>
          </div>
          <span style={resultsCountStyle}>
            {displaySlots.length} result{displaySlots.length === 1 ? "" : "s"}
          </span>
        </div>

        <ParkingMap
          activeRouteId={activeRouteId}
          emptyLabel="These results do not include map coordinates yet, so the card grid is doing the heavy lifting."
          isRouting={isRouting}
          onRouteSelect={setActiveRouteId}
          onSelect={setSelectedSlotId}
          routeOptions={routeOptions}
          routingProvider={supportsGoogleMaps ? "google" : "leaflet"}
          selectedSlotId={selectedSlotId}
          slots={displaySlots}
          subtitle={
            supportsGoogleMaps
              ? "Tap a marker to focus a slot, then compare the live ETA route options below."
              : "Tap a marker to focus a slot, then compare the compact cards below."
          }
          title="Live Parking Map"
          userLocation={userLocation}
        />

        <div style={sectionHeadingStyle}>
          <div>
            <h2 style={{ margin: "0 0 6px", color: "#102a43" }}>
              Available Parking
            </h2>
            <p style={sectionEyebrowStyle}>
              Cards are smaller now and flow row by row so you can scan more options without endless scrolling.
            </p>
          </div>
        </div>

        <div style={listPanelStyle}>
          {displaySlotsWithFavorites.map((slot) => (
            <ParkingSlotCard
              bookingValue={getBookingValues(slot._id)}
              isBooking={activeBookingId === slot._id}
              isFavorite={slot.isFavorite}
              isSelected={selectedSlotId === slot._id}
              isTogglingFavorite={activeFavoriteId === slot._id}
              key={slot._id}
              onBook={handleBooking}
              onBookingChange={handleBookingChange}
              onSelect={setSelectedSlotId}
              onToggleFavorite={handleToggleFavorite}
              slot={slot}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default SearchPage;
