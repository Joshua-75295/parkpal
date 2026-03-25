import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader.jsx";
import Toast from "../components/Toast.jsx";
import { cancelBooking, getMyBookings } from "../services/bookingService.js";
import { getApiErrorMessage } from "../services/api.js";
import {
  addFavoriteParkingSlot,
  getFavoriteParkingSlotIds,
  removeFavoriteParkingSlot,
} from "../services/parkingService.js";
import {
  REALTIME_EVENTS,
  subscribeToRealtimeEvent,
} from "../services/realtimeService.js";
import {
  APP_ROUTES,
  BOOKING_CANCELLATION_REASON_LABELS,
  BOOKING_SPOT_PREFERENCE_LABELS,
  BOOKING_STATUS_LABELS,
  BOOKING_VALIDATION_LABELS,
  PARKING_SPOT_TYPE_LABELS,
} from "../utils/constants.js";
import { formatDateTime, toDateTimeLocalValue } from "../utils/formatDate.js";

const pageStyle = {
  display: "grid",
  gap: "18px",
  padding: "36px 0 20px",
};

const cardStyle = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "22px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  boxShadow: "0 18px 40px rgba(16, 42, 67, 0.08)",
};

const badgeStyle = (status) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "6px 12px",
  background:
    status === "cancelled"
      ? "rgba(217, 45, 32, 0.1)"
      : status === "completed"
        ? "rgba(51, 65, 85, 0.1)"
        : "rgba(15, 118, 110, 0.12)",
  color:
    status === "cancelled"
      ? "#b42318"
      : status === "completed"
        ? "#334155"
        : "#0f766e",
  fontWeight: 700,
  fontSize: "0.85rem",
});

const validationBadgeStyle = (validationStatus) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "6px 12px",
  background:
    validationStatus === "validated"
      ? "rgba(15, 118, 110, 0.12)"
      : "rgba(245, 158, 11, 0.14)",
  color: validationStatus === "validated" ? "#0f766e" : "#b45309",
  fontWeight: 700,
  fontSize: "0.85rem",
});

const cancellationBadgeStyle = (cancellationReason) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "6px 12px",
  background:
    cancellationReason === "expired"
      ? "rgba(245, 158, 11, 0.14)"
      : "rgba(217, 45, 32, 0.1)",
  color: cancellationReason === "expired" ? "#b45309" : "#b42318",
  fontWeight: 700,
  fontSize: "0.85rem",
});

const actionRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const cancelButtonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "11px 14px",
  background: "#b42318",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  border: "1px solid rgba(16, 42, 67, 0.12)",
  borderRadius: "12px",
  padding: "11px 14px",
  background: "#ffffff",
  color: "#102a43",
  fontWeight: 700,
  cursor: "pointer",
};

const favoriteButtonStyle = (isFavorite) => ({
  ...secondaryButtonStyle,
  border: "1px solid rgba(29, 78, 216, 0.18)",
  background: isFavorite ? "rgba(29, 78, 216, 0.12)" : "#ffffff",
  color: "#1d4ed8",
});

const roundDateUpToNextQuarterHour = (value) => {
  const roundedDate = new Date(value);
  roundedDate.setSeconds(0, 0);

  const remainder = roundedDate.getMinutes() % 15;

  if (remainder !== 0) {
    roundedDate.setMinutes(roundedDate.getMinutes() + (15 - remainder));
  }

  return roundedDate;
};

const buildRebookRequest = (booking) => {
  if (!booking?.parkingSlot?._id) {
    return null;
  }

  const originalStart = new Date(booking.startTime);
  const originalEnd = new Date(booking.endTime);
  const durationMs = Math.max(originalEnd - originalStart, 60 * 60 * 1000);
  const fallbackStart = roundDateUpToNextQuarterHour(
    new Date(Date.now() + 30 * 60 * 1000)
  );
  const nextStart = originalStart > fallbackStart ? originalStart : fallbackStart;
  const nextEnd = new Date(nextStart.getTime() + durationMs);

  return {
    endTime: toDateTimeLocalValue(nextEnd),
    parkingSlotId: booking.parkingSlot._id,
    parkingTitle: booking.parkingSlot.title ?? "Parking Slot",
    spotPreference: booking.spotPreference ?? "nearest",
    startTime: toDateTimeLocalValue(nextStart),
  };
};

function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [favoriteParkingSlotIds, setFavoriteParkingSlotIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCancelId, setActiveCancelId] = useState("");
  const [activeFavoriteId, setActiveFavoriteId] = useState("");
  const [toast, setToast] = useState(null);

  const favoriteParkingSlotIdSet = useMemo(
    () => new Set(favoriteParkingSlotIds),
    [favoriteParkingSlotIds]
  );

  const loadBookings = useCallback(async () => {
    setIsLoading(true);

    try {
      const userBookings = await getMyBookings();
      setBookings(userBookings);
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Bookings unavailable",
        message: getApiErrorMessage(requestError, "Could not load your bookings."),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    loadBookings();
    loadFavoriteSlots().catch(() => null);
  }, [loadBookings, loadFavoriteSlots]);

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeEvent(
      REALTIME_EVENTS.bookingChanged,
      () => {
        loadBookings().catch(() => null);
      }
    );

    return unsubscribe;
  }, [loadBookings]);

  const handleCancel = async (bookingId) => {
    setActiveCancelId(bookingId);

    try {
      await cancelBooking(bookingId);
      setToast({
        type: "success",
        title: "Booking cancelled",
        message: "Your reservation was cancelled successfully.",
      });
      await loadBookings();
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Cancel failed",
        message: getApiErrorMessage(requestError, "Cancel failed."),
      });
    } finally {
      setActiveCancelId("");
    }
  };

  const handleToggleFavorite = async (parkingSlotId) => {
    setActiveFavoriteId(parkingSlotId);

    try {
      const nextFavoriteParkingSlotIds = favoriteParkingSlotIdSet.has(parkingSlotId)
        ? await removeFavoriteParkingSlot(parkingSlotId)
        : await addFavoriteParkingSlot(parkingSlotId);

      setFavoriteParkingSlotIds(nextFavoriteParkingSlotIds);
      setToast({
        type: "success",
        title: favoriteParkingSlotIdSet.has(parkingSlotId)
          ? "Saved slot removed"
          : "Saved slot updated",
        message: favoriteParkingSlotIdSet.has(parkingSlotId)
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

  const handleQuickRebook = (booking) => {
    const rebookRequest = buildRebookRequest(booking);

    if (!rebookRequest) {
      setToast({
        type: "error",
        title: "Quick rebook unavailable",
        message: "This booking no longer has an active parking slot to rebook.",
      });
      return;
    }

    navigate(APP_ROUTES.search, {
      state: {
        rebookRequest,
      },
    });
  };

  return (
    <section style={pageStyle}>
      <Toast onDismiss={() => setToast(null)} toast={toast} />
      <div>
        <h1 style={{ marginBottom: "8px", color: "#102a43" }}>My Bookings</h1>
        <p style={{ margin: 0, color: "#486581", lineHeight: 1.7 }}>
          Track every active, completed, or cancelled reservation from one view,
          then save or rebook your usual parking spots in a couple of taps.
        </p>
      </div>

      {isLoading ? <Loader label="Loading your bookings..." /> : null}

      {!isLoading && bookings.length === 0 ? (
        <p style={{ color: "#486581" }}>
          You do not have any bookings yet.
        </p>
      ) : null}

      {bookings.map((booking) => {
        const parkingSlotId = booking.parkingSlot?._id ?? "";
        const isFavorite = parkingSlotId
          ? favoriteParkingSlotIdSet.has(parkingSlotId)
          : false;

        return (
          <article key={booking._id} style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "8px",
                  }}
                >
                  <span style={badgeStyle(booking.status)}>
                    {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                  </span>
                  <span
                    style={
                      booking.status === "cancelled"
                        ? cancellationBadgeStyle(booking.cancellationReason)
                        : validationBadgeStyle(booking.validationStatus)
                    }
                  >
                    {booking.status === "cancelled"
                      ? BOOKING_CANCELLATION_REASON_LABELS[
                          booking.cancellationReason
                        ] ?? "Cancelled"
                      : BOOKING_VALIDATION_LABELS[booking.validationStatus] ??
                        booking.validationStatus}
                  </span>
                </div>
                <h2 style={{ marginBottom: "8px", color: "#102a43" }}>
                  {booking.parkingSlot?.title ?? "Parking Slot"}
                </h2>
                <p style={{ margin: "6px 0", color: "#486581" }}>
                  Spot: {booking.parkingSpot?.label ?? "Assigned on arrival"}
                </p>
                <p style={{ margin: "6px 0", color: "#486581" }}>
                  Preference:{" "}
                  {BOOKING_SPOT_PREFERENCE_LABELS[booking.spotPreference] ??
                    booking.spotPreference ??
                    "Nearest Available"}
                </p>
                {booking.parkingSpot?.spotType ? (
                  <p style={{ margin: "6px 0", color: "#486581" }}>
                    Assigned type:{" "}
                    {PARKING_SPOT_TYPE_LABELS[booking.parkingSpot.spotType] ??
                      booking.parkingSpot.spotType}
                    {booking.parkingSpot.distanceFromEntrance != null
                      ? ` | Entrance rank #${booking.parkingSpot.distanceFromEntrance}`
                      : ""}
                  </p>
                ) : null}
                <p style={{ margin: "6px 0", color: "#486581" }}>
                  From: {formatDateTime(booking.startTime)}
                </p>
                <p style={{ margin: "6px 0", color: "#486581" }}>
                  To: {formatDateTime(booking.endTime)}
                </p>
                <p style={{ margin: "6px 0", color: "#486581" }}>
                  Total price: Rs. {booking.totalPrice ?? 0}
                </p>
                {booking.status === "booked" &&
                booking.validationStatus === "pending" &&
                booking.expiresAt ? (
                  <p style={{ margin: "6px 0", color: "#486581" }}>
                    Validate by: {formatDateTime(booking.expiresAt)}
                  </p>
                ) : null}
                {booking.status === "cancelled" && booking.cancelledAt ? (
                  <p style={{ margin: "6px 0", color: "#486581" }}>
                    {BOOKING_CANCELLATION_REASON_LABELS[
                      booking.cancellationReason
                    ] ?? "Cancelled"} on {formatDateTime(booking.cancelledAt)}
                  </p>
                ) : null}
                {booking.validationStatus === "validated" ? (
                  <p style={{ margin: "6px 0", color: "#486581" }}>
                    Validated by: {booking.validatedBy?.name ?? "Admin"} on{" "}
                    {formatDateTime(booking.validatedAt)}
                  </p>
                ) : null}
              </div>
            </div>

            {booking.parkingSlot ? (
              <div style={actionRowStyle}>
                <button
                  onClick={() => handleQuickRebook(booking)}
                  style={secondaryButtonStyle}
                  type="button"
                >
                  Quick Rebook
                </button>
                <button
                  onClick={() => handleToggleFavorite(parkingSlotId)}
                  style={favoriteButtonStyle(isFavorite)}
                  type="button"
                >
                  {activeFavoriteId === parkingSlotId
                    ? "Saving..."
                    : isFavorite
                      ? "Saved Slot"
                      : "Save Slot"}
                </button>
                {booking.status === "booked" ? (
                  <button
                    disabled={activeCancelId === booking._id}
                    onClick={() => handleCancel(booking._id)}
                    style={cancelButtonStyle}
                    type="button"
                  >
                    {activeCancelId === booking._id
                      ? "Cancelling..."
                      : "Cancel Booking"}
                  </button>
                ) : null}
              </div>
            ) : booking.status === "booked" ? (
              <div style={actionRowStyle}>
                <button
                  disabled={activeCancelId === booking._id}
                  onClick={() => handleCancel(booking._id)}
                  style={cancelButtonStyle}
                  type="button"
                >
                  {activeCancelId === booking._id
                    ? "Cancelling..."
                    : "Cancel Booking"}
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

export default MyBookingsPage;
