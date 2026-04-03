import BookingForm from "./BookingForm.jsx";
import {
  formatTravelSummary,
  getParkingPreviewImageUrl,
} from "../services/parkingService.js";
import { PARKING_SPOT_TYPE_LABELS } from "../utils/constants.js";

const cardStyle = {
  display: "grid",
  gap: "14px",
  height: "100%",
  borderRadius: "20px",
  border: "1px solid rgba(16, 42, 67, 0.08)",
  background: "#ffffff",
  padding: "16px",
  boxShadow: "0 16px 32px rgba(16, 42, 67, 0.08)",
  transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
};

const topRowStyle = {
  display: "grid",
  gap: "12px",
};

const mediaStyle = {
  width: "100%",
  height: "168px",
  objectFit: "cover",
  borderRadius: "16px",
  background:
    "linear-gradient(135deg, rgba(20, 184, 166, 0.14), rgba(59, 130, 246, 0.14))",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "5px 10px",
  background: "rgba(15, 118, 110, 0.12)",
  color: "#0f766e",
  fontWeight: 700,
  fontSize: "0.78rem",
};

const titleStyle = {
  margin: 0,
  fontSize: "1.1rem",
  color: "#102a43",
};

const textStyle = {
  margin: 0,
  color: "#486581",
  fontSize: "0.95rem",
  lineHeight: 1.55,
};

const priceStyle = {
  color: "#134e4a",
  fontSize: "1.2rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const mapButtonStyle = (isSelected) => ({
  border: "1px solid rgba(15, 118, 110, 0.18)",
  borderRadius: "999px",
  padding: "8px 12px",
  background: isSelected ? "rgba(15, 118, 110, 0.12)" : "#ffffff",
  color: "#0f766e",
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: "pointer",
});

const favoriteButtonStyle = (isFavorite) => ({
  border: "1px solid rgba(29, 78, 216, 0.18)",
  borderRadius: "999px",
  padding: "8px 12px",
  background: isFavorite ? "rgba(29, 78, 216, 0.12)" : "#ffffff",
  color: "#1d4ed8",
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: "pointer",
});

const headerRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap",
};

const detailsStyle = {
  display: "grid",
  gap: "6px",
};

const actionRowStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const getLocationText = (location) =>
  typeof location === "string" ? location : location?.address ?? "Location unavailable";

const getConfiguredSpotMix = (slot) => {
  const totalSpots = Number(slot.totalActiveSpots ?? slot.availableSlots ?? 0);
  const accessibleSpots =
    Number(slot.allocationConfig?.accessibleSpotCount ?? 0) || 0;
  const vipSpots = Number(slot.allocationConfig?.vipSpotCount ?? 0) || 0;

  return {
    accessible: accessibleSpots,
    standard: Math.max(totalSpots - accessibleSpots - vipSpots, 0),
    vip: vipSpots,
  };
};

const formatSpotMix = (spotMix, label) => {
  const parts = Object.entries(spotMix)
    .filter(([, count]) => Number(count) > 0)
    .map(
      ([spotType, count]) =>
        `${count} ${PARKING_SPOT_TYPE_LABELS[spotType] ?? spotType}`
    );

  if (parts.length === 0) {
    return null;
  }

  return `${label}: ${parts.join(" | ")}`;
};

function ParkingSlotCard({
  bookingValue,
  isBooking,
  isFavorite,
  isTogglingFavorite,
  isSelected,
  onBook,
  onBookingChange,
  onSelect,
  onToggleFavorite,
  slot,
}) {
  const availableLabel =
    slot.availableSpotCount != null
      ? `${slot.availableSpotCount} spot${slot.availableSpotCount === 1 ? "" : "s"} open`
      : `${slot.availableSlots ?? 0} total spot${slot.availableSlots === 1 ? "" : "s"}`;
  const spotMixLabel = formatSpotMix(
    slot.availableSpotMix ?? getConfiguredSpotMix(slot),
    slot.availableSpotMix ? "Open mix" : "Spot mix"
  );

  return (
    <article
      style={{
        ...cardStyle,
        border: isSelected
          ? "1px solid rgba(15, 118, 110, 0.3)"
          : cardStyle.border,
        boxShadow: isSelected
          ? "0 20px 38px rgba(15, 118, 110, 0.12)"
          : cardStyle.boxShadow,
      }}
    >
      <img
        alt={slot.title}
        src={getParkingPreviewImageUrl(slot)}
        style={mediaStyle}
      />

      <div style={topRowStyle}>
        <div style={headerRowStyle}>
          <span style={badgeStyle}>{availableLabel}</span>
          <div style={priceStyle}>Rs. {slot.pricePerHour}/hour</div>
        </div>

        <div style={detailsStyle}>
          <h3 style={titleStyle}>{slot.title}</h3>
          <p style={textStyle}>{getLocationText(slot.location)}</p>
          {slot.distanceFromUserKm != null ? (
            <p style={textStyle}>
              {slot.distanceMethod === "road" ? "Drive: " : "Approx. "}
              {formatTravelSummary(
                slot.distanceFromUserKm,
                slot.travelDurationMinutes,
                slot.distanceMethod
              )}
            </p>
          ) : null}
          <p style={textStyle}>Owner: {slot.owner?.name ?? "ParkPal Host"}</p>
          {spotMixLabel ? <p style={textStyle}>{spotMixLabel}</p> : null}
        </div>

        <div style={actionRowStyle}>
          {onToggleFavorite ? (
            <button
              onClick={() => onToggleFavorite(slot._id)}
              style={favoriteButtonStyle(isFavorite)}
              type="button"
            >
              {isTogglingFavorite ? "Saving..." : isFavorite ? "Saved Slot" : "Save Slot"}
            </button>
          ) : null}
          {slot.location?.lat != null && slot.location?.lng != null ? (
            <button
              onClick={() => onSelect?.(slot._id)}
              style={mapButtonStyle(isSelected)}
              type="button"
            >
              {isSelected ? "Focused on map" : "Show on map"}
            </button>
          ) : null}
        </div>
      </div>

      <BookingForm
        isSubmitting={isBooking}
        onChange={(field, value) => onBookingChange(slot._id, field, value)}
        onSubmit={() => onBook(slot._id)}
        value={bookingValue}
      />
    </article>
  );
}

export default ParkingSlotCard;
