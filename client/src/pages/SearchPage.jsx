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
  formatDistanceAway,
  getFavoriteParkingSlotIds,
  getParkingSlots,
  hasSlotCoordinates,
  removeFavoriteParkingSlot,
  requestBrowserLocation,
  sortSlotsByDistance,
} from "../services/parkingService.js";
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
  gap: "22px",
  padding: "36px 0 20px",
};

const heroStyle = {
  display: "grid",
  gap: "10px",
};

const filterCardStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "22px",
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
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "16px",
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

const resultsLayoutStyle = {
  display: "grid",
  gap: "20px",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
};

const listPanelStyle = {
  display: "grid",
  gap: "18px",
};

const summaryGridStyle = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};

const summaryCardStyle = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "16px",
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

function SearchPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [slots, setSlots] = useState([]);
  const [bookingData, setBookingData] = useState({});
  const [favoriteParkingSlotIds, setFavoriteParkingSlotIds] = useState([]);
  const [hasHandledRebookRequest, setHasHandledRebookRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBookingId, setActiveBookingId] = useState("");
  const [activeFavoriteId, setActiveFavoriteId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isNearestMode, setIsNearestMode] = useState(false);
  const [toast, setToast] = useState(null);
  const rebookRequest = routerLocation.state?.rebookRequest ?? null;

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

  const slotsWithDistance = useMemo(
    () => enrichSlotsWithDistance(slots, userLocation),
    [slots, userLocation]
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
        ? formatDistanceAway(nearestMappedSlot.distanceFromUserKm)
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
    (location) =>
      sortSlotsByDistance(enrichSlotsWithDistance(slots, location)).find(
        (slot) =>
          hasSlotCoordinates(slot) && slot.distanceFromUserKm != null
      ) ?? null,
    [slots]
  );

  const handleUseMyLocation = async () => {
    const location = await resolveUserLocation();

    if (!location) {
      return;
    }

    setToast({
      type: "success",
      title: "Location ready",
      message:
        "Distance estimates are now live. You can sort results by the nearest parking slot.",
    });
  };

  const handleShowNearestParking = async () => {
    const location = userLocation ?? (await resolveUserLocation());

    if (!location) {
      return;
    }

    const nearestSlot = findNearestMappedSlot(location);

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
      message: `${nearestSlot.title} is the closest mapped option at ${formatDistanceAway(
        nearestSlot.distanceFromUserKm
      )}.`,
    });
  };

  const handleClearLocationTools = () => {
    setUserLocation(null);
    setIsNearestMode(false);
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
          your location to sort by the nearest mapped parking slot and preview a
          route line on the map.
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
              Closest mapped
            </strong>
            <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#102a43" }}>
              {summary.closestDistance || "Not available"}
            </span>
            <p style={{ margin: "8px 0 0", color: "#486581" }}>
              {summary.closestTitle || "No map-ready slots in these results yet."}
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
                ? "Nearest-first sorting is active and the blue route line follows the focused slot on the map."
                : "Distance estimates are live. Turn on nearest parking to sort the list by proximity."
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

      <div style={resultsLayoutStyle}>
        <div style={{ alignSelf: "start" }}>
          <ParkingMap
            emptyLabel="These results do not include map coordinates yet, so the list is doing the heavy lifting."
            onSelect={setSelectedSlotId}
            selectedSlotId={selectedSlotId}
            slots={displaySlots}
            title="Live Parking Map"
            userLocation={userLocation}
          />
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
