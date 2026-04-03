import { toDateTimeLocalValue } from "../utils/formatDate.js";
import { BOOKING_SPOT_PREFERENCE_LABELS } from "../utils/constants.js";

const formStyle = {
  display: "grid",
  gap: "12px",
  marginTop: "14px",
};

const inputGridStyle = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  minWidth: 0,
  color: "#334e68",
  fontWeight: 600,
  fontSize: "0.88rem",
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #bcccdc",
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "0.92rem",
  background: "#f8fbfd",
};

const buttonStyle = {
  border: "none",
  borderRadius: "10px",
  background: "#0f766e",
  color: "#ffffff",
  padding: "11px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

function BookingForm({ isSubmitting, onChange, onSubmit, value }) {
  const minimumDateTime = toDateTimeLocalValue(new Date());

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <div style={inputGridStyle}>
        <label style={labelStyle}>
          Start time
          <input
            min={minimumDateTime}
            onChange={(event) => onChange("startTime", event.target.value)}
            style={inputStyle}
            type="datetime-local"
            value={value.startTime ?? ""}
          />
        </label>

        <label style={labelStyle}>
          End time
          <input
            min={value.startTime || minimumDateTime}
            onChange={(event) => onChange("endTime", event.target.value)}
            style={inputStyle}
            type="datetime-local"
            value={value.endTime ?? ""}
          />
        </label>

        <label
          style={{
            ...labelStyle,
            gridColumn: "1 / -1",
          }}
        >
          Spot preference
          <select
            onChange={(event) => onChange("spotPreference", event.target.value)}
            style={inputStyle}
            value={value.spotPreference ?? "nearest"}
          >
            {Object.entries(BOOKING_SPOT_PREFERENCE_LABELS).map(
              ([preferenceValue, label]) => (
                <option key={preferenceValue} value={preferenceValue}>
                  {label}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      <button disabled={isSubmitting} style={buttonStyle} type="submit">
        {isSubmitting ? "Booking..." : "Book Slot"}
      </button>
    </form>
  );
}

export default BookingForm;
