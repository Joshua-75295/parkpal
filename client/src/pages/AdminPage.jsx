import { useCallback, useEffect, useMemo, useState } from "react";
import Loader from "../components/Loader.jsx";
import ParkingMap from "../components/ParkingMap.jsx";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../context/auth-context.js";
import {
  createAdminUser,
  getAdmins,
  getManagedAnalytics,
  getTodayManagedBookings,
  validateManagedBooking,
} from "../services/adminService.js";
import { getApiErrorMessage } from "../services/api.js";
import {
  createParkingSlot,
  deleteParkingSlot,
  getLocationText,
  getManagedParkingSlots,
  readImageFileAsDataUrl,
  resolveParkingImageUrl,
  updateParkingSlot,
} from "../services/parkingService.js";
import {
  REALTIME_EVENTS,
  subscribeToRealtimeEvent,
} from "../services/realtimeService.js";
import {
  BOOKING_CANCELLATION_REASON_LABELS,
  BOOKING_SPOT_PREFERENCE_LABELS,
  BOOKING_STATUS_LABELS,
  BOOKING_VALIDATION_LABELS,
  PARKING_STATUS_LABELS,
  PARKING_SPOT_TYPE_LABELS,
  ROLE_LABELS,
} from "../utils/constants.js";
import { formatDateTime, formatShortDate } from "../utils/formatDate.js";

const ANALYTICS_WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const getLocalDateValue = () => {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

const createParkingForm = () => ({
  title: "",
  address: "",
  lat: "",
  lng: "",
  imageData: "",
  imageFileName: "",
  imageUrl: "",
  pricePerHour: "",
  availableSlots: "",
  accessibleSpotCount: "0",
  vipSpotCount: "0",
  status: "active",
});

const createAdminForm = () => ({
  name: "",
  email: "",
  password: "",
});

const createEmptyAnalytics = () => ({
  range: {
    days: 7,
    startDate: null,
    endDate: null,
    timezone: "UTC",
  },
  summary: {
    managedSlots: 0,
    activeSlots: 0,
    maintenanceSlots: 0,
    totalConfiguredSpots: 0,
    activeConfiguredSpots: 0,
    totalBookings: 0,
    cancelledBookings: 0,
    validatedBookings: 0,
    totalRevenue: 0,
    averageDailyRevenue: 0,
    bookedHours: 0,
    capacityHours: 0,
    occupancyRate: 0,
    cancellationRate: 0,
    validationRate: 0,
  },
  dailyRevenue: [],
  cancellationTrend: [],
  peakHours: [],
});

const styles = {
  page: {
    display: "grid",
    gap: "22px",
    padding: "36px 0 20px",
  },
  grid: {
    display: "grid",
    gap: "20px",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  },
  column: {
    display: "grid",
    gap: "20px",
    alignContent: "start",
  },
  summaryGrid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  summaryCard: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "18px",
    border: "1px solid rgba(16, 42, 67, 0.08)",
    boxShadow: "0 18px 40px rgba(16, 42, 67, 0.06)",
  },
  card: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "22px",
    border: "1px solid rgba(16, 42, 67, 0.08)",
    boxShadow: "0 18px 40px rgba(16, 42, 67, 0.08)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  formGrid: {
    display: "grid",
    gap: "14px",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  analyticsGrid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  analyticsPanels: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    marginTop: "20px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#334e68",
    fontWeight: 600,
    fontSize: "0.95rem",
  },
  input: {
    border: "1px solid #bcccdc",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "0.95rem",
    background: "#f8fbfd",
  },
  buttons: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#134e4a",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(16, 42, 67, 0.12)",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#ffffff",
    color: "#102a43",
    fontWeight: 700,
    cursor: "pointer",
  },
  dangerButton: {
    border: "none",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "#b91c1c",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },
  subtleButton: {
    border: "1px solid rgba(15, 118, 110, 0.18)",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "rgba(15, 118, 110, 0.06)",
    color: "#0f766e",
    cursor: "pointer",
    fontWeight: 700,
  },
  list: {
    display: "grid",
    gap: "14px",
  },
  listCard: {
    borderRadius: "20px",
    border: "1px solid rgba(16, 42, 67, 0.08)",
    background: "#f8fbfd",
    padding: "16px",
  },
  badgeRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "10px",
  },
  media: {
    width: "120px",
    minWidth: "120px",
    height: "92px",
    objectFit: "cover",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(20, 184, 166, 0.14), rgba(59, 130, 246, 0.14))",
  },
  text: {
    margin: "4px 0",
    color: "#486581",
    lineHeight: 1.6,
  },
  miniRows: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  miniRow: {
    display: "grid",
    gap: "8px",
  },
  miniRowTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  barTrack: {
    height: "8px",
    borderRadius: "999px",
    background: "rgba(148, 163, 184, 0.18)",
    overflow: "hidden",
  },
};

const getBadgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "6px 12px",
  background:
    tone === "danger"
      ? "rgba(220, 38, 38, 0.12)"
      : tone === "warning"
      ? "rgba(245, 158, 11, 0.14)"
      : "rgba(15, 118, 110, 0.12)",
  color:
    tone === "danger"
      ? "#b91c1c"
      : tone === "warning"
      ? "#b45309"
      : "#0f766e",
  fontWeight: 700,
  fontSize: "0.85rem",
});

const getCancellationTone = (cancellationReason) =>
  cancellationReason === "expired" ? "warning" : "danger";

const getParkingTone = (status) => {
  if (status === "maintenance") {
    return "warning";
  }

  if (status === "inactive") {
    return "danger";
  }

  return "success";
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const formatMetricNumber = (value) =>
  numberFormatter.format(Number(value) || 0);

const formatPercent = (value) =>
  `${numberFormatter.format(Number(value) || 0)}%`;

const getBarFillStyle = (value, maximum, color) => ({
  height: "100%",
  borderRadius: "inherit",
  width: `${
    maximum > 0 ? Math.max((value / maximum) * 100, value > 0 ? 6 : 0) : 0
  }%`,
  background: color,
  transition: "width 180ms ease",
});

const getParkingFormFromSlot = (slot) => ({
  title: slot.title ?? "",
  address:
    typeof slot.location === "string"
      ? slot.location
      : slot.location?.address ?? "",
  lat: slot.location?.lat?.toString() ?? "",
  lng: slot.location?.lng?.toString() ?? "",
  imageData: "",
  imageFileName: "",
  imageUrl: slot.imageUrl ?? "",
  pricePerHour: slot.pricePerHour?.toString() ?? "",
  availableSlots: slot.availableSlots?.toString() ?? "",
  accessibleSpotCount:
    slot.allocationConfig?.accessibleSpotCount?.toString() ?? "0",
  vipSpotCount: slot.allocationConfig?.vipSpotCount?.toString() ?? "0",
  status: slot.status ?? "active",
});

const getConfiguredSpotMix = (slot) => {
  const totalSpots = Number(slot.availableSlots ?? 0);
  const accessibleSpots =
    Number(slot.allocationConfig?.accessibleSpotCount ?? 0) || 0;
  const vipSpots = Number(slot.allocationConfig?.vipSpotCount ?? 0) || 0;

  return {
    standard: Math.max(totalSpots - accessibleSpots - vipSpots, 0),
    vip: vipSpots,
    accessible: accessibleSpots,
  };
};

const formatSpotMix = (spotMix) =>
  Object.entries(spotMix)
    .filter(([, count]) => Number(count) > 0)
    .map(
      ([spotType, count]) =>
        `${count} ${PARKING_SPOT_TYPE_LABELS[spotType] ?? spotType}`
    )
    .join(" • ");

function AdminPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [parkingForm, setParkingForm] = useState(createParkingForm);
  const [adminForm, setAdminForm] = useState(createAdminForm);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingSummary, setBookingSummary] = useState({
    total: 0,
    pendingValidation: 0,
    validated: 0,
  });
  const [analytics, setAnalytics] = useState(createEmptyAnalytics);
  const [admins, setAdmins] = useState([]);
  const [toast, setToast] = useState(null);
  const [analyticsWindowDays, setAnalyticsWindowDays] = useState("7");
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(isSuperAdmin);
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [activeDeleteId, setActiveDeleteId] = useState("");
  const [activeValidateId, setActiveValidateId] = useState("");
  const [editingSlotId, setEditingSlotId] = useState("");
  const [parkingImageInputKey, setParkingImageInputKey] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getLocalDateValue);

  const loadManagedSlots = useCallback(async () => {
    setIsLoadingSlots(true);

    try {
      setSlots(await getManagedParkingSlots());
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Slot load failed",
        message: getApiErrorMessage(
          requestError,
          "Could not load managed parking slots."
        ),
      });
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  const loadManagedBookings = useCallback(async (dateValue) => {
    setIsLoadingBookings(true);

    try {
      const response = await getTodayManagedBookings(dateValue);
      setBookings(response.bookings);
      setBookingSummary(response.summary);
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Booking monitor unavailable",
        message: getApiErrorMessage(
          requestError,
          "Could not load managed bookings."
        ),
      });
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  const loadAdmins = useCallback(async () => {
    if (!isSuperAdmin) {
      setAdmins([]);
      setIsLoadingAdmins(false);
      return;
    }

    setIsLoadingAdmins(true);

    try {
      setAdmins(await getAdmins());
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Admin list unavailable",
        message: getApiErrorMessage(requestError, "Could not load admins."),
      });
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [isSuperAdmin]);

  const loadManagedAnalytics = useCallback(async (daysValue) => {
    setIsLoadingAnalytics(true);

    try {
      setAnalytics(await getManagedAnalytics(daysValue));
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Analytics unavailable",
        message: getApiErrorMessage(
          requestError,
          "Could not load dashboard analytics."
        ),
      });
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    loadManagedSlots();
  }, [loadManagedSlots]);

  useEffect(() => {
    loadManagedAnalytics(analyticsWindowDays);
  }, [analyticsWindowDays, loadManagedAnalytics]);

  useEffect(() => {
    loadManagedBookings(selectedDate);
  }, [loadManagedBookings, selectedDate]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  useEffect(() => {
    const unsubscribeInventory = subscribeToRealtimeEvent(
      REALTIME_EVENTS.inventoryChanged,
      () => {
        loadManagedSlots().catch(() => null);
        loadManagedAnalytics(analyticsWindowDays).catch(() => null);
      }
    );

    const unsubscribeBookings = subscribeToRealtimeEvent(
      REALTIME_EVENTS.bookingChanged,
      () => {
        loadManagedBookings(selectedDate).catch(() => null);
        loadManagedAnalytics(analyticsWindowDays).catch(() => null);
      }
    );

    return () => {
      unsubscribeInventory();
      unsubscribeBookings();
    };
  }, [
    analyticsWindowDays,
    loadManagedAnalytics,
    loadManagedBookings,
    loadManagedSlots,
    selectedDate,
  ]);

  useEffect(() => {
    if (!slots.length) {
      setSelectedSlotId("");
      return;
    }

    if (selectedSlotId && slots.some((slot) => slot._id === selectedSlotId)) {
      return;
    }

    setSelectedSlotId(slots[0]._id);
  }, [selectedSlotId, slots]);

  const summary = useMemo(
    () => ({
      slotCount: slots.length,
      todayBookings: bookingSummary.total,
      pendingValidation: bookingSummary.pendingValidation,
      maintenanceSlots: slots.filter((slot) => slot.status === "maintenance")
        .length,
      admins: admins.filter((admin) => admin.role === "admin").length,
    }),
    [admins, bookingSummary, slots]
  );

  const parkingFormImagePreviewUrl = useMemo(
    () => resolveParkingImageUrl(parkingForm.imageData || parkingForm.imageUrl),
    [parkingForm.imageData, parkingForm.imageUrl]
  );

  const revenueBarMaximum = useMemo(
    () =>
      Math.max(
        ...analytics.dailyRevenue.map((entry) => Number(entry.revenue) || 0),
        0
      ),
    [analytics.dailyRevenue]
  );

  const peakHourBarMaximum = useMemo(
    () =>
      Math.max(
        ...analytics.peakHours.map((entry) => Number(entry.bookingCount) || 0),
        0
      ),
    [analytics.peakHours]
  );

  const cancellationBarMaximum = useMemo(
    () =>
      Math.max(
        ...analytics.cancellationTrend.map(
          (entry) => Number(entry.cancelledBookings) || 0
        ),
        0
      ),
    [analytics.cancellationTrend]
  );

  const handleParkingInputChange = (event) => {
    setParkingForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleParkingImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const imageData = await readImageFileAsDataUrl(file);

      setParkingForm((current) => ({
        ...current,
        imageData,
        imageFileName: file.name,
      }));
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Image upload failed",
        message: requestError.message,
      });
      setParkingImageInputKey((currentKey) => currentKey + 1);
    }
  };

  const handleClearParkingImage = () => {
    setParkingForm((current) => ({
      ...current,
      imageData: "",
      imageFileName: "",
      imageUrl: "",
    }));
    setParkingImageInputKey((currentKey) => currentKey + 1);
  };

  const handleAdminInputChange = (event) => {
    setAdminForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleParkingReset = () => {
    setParkingForm(createParkingForm());
    setEditingSlotId("");
    setParkingImageInputKey((currentKey) => currentKey + 1);
  };

  const handleEditSlot = (slot) => {
    setParkingForm(getParkingFormFromSlot(slot));
    setEditingSlotId(slot._id);
    setSelectedSlotId(slot._id);
    setParkingImageInputKey((currentKey) => currentKey + 1);
  };

  const handleSaveSlot = async (event) => {
    event.preventDefault();
    setIsSavingSlot(true);

    try {
      const savedSlot = editingSlotId
        ? await updateParkingSlot(editingSlotId, parkingForm)
        : await createParkingSlot(parkingForm);

      setToast({
        type: "success",
        title: editingSlotId ? "Parking slot updated" : "Parking slot created",
        message: `${savedSlot.title} is ready for bookings.`,
      });
      handleParkingReset();
      await loadManagedSlots();
      setSelectedSlotId(savedSlot._id);
    } catch (requestError) {
      setToast({
        type: "error",
        title: editingSlotId ? "Update failed" : "Create failed",
        message: getApiErrorMessage(requestError, "Could not save parking slot."),
      });
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (parkingSlotId) => {
    setActiveDeleteId(parkingSlotId);

    try {
      await deleteParkingSlot(parkingSlotId);
      setToast({
        type: "success",
        title: "Parking slot removed",
        message: "The parking slot was removed successfully.",
      });
      if (editingSlotId === parkingSlotId) {
        handleParkingReset();
      }
      await loadManagedSlots();
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Delete failed",
        message: getApiErrorMessage(
          requestError,
          "Could not delete parking slot."
        ),
      });
    } finally {
      setActiveDeleteId("");
    }
  };

  const handleValidateBooking = async (bookingId) => {
    setActiveValidateId(bookingId);

    try {
      await validateManagedBooking(bookingId);
      setToast({
        type: "success",
        title: "Booking validated",
        message: "The booking has been confirmed at the admin desk.",
      });
      await loadManagedBookings(selectedDate);
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Validation failed",
        message: getApiErrorMessage(requestError, "Could not validate booking."),
      });
    } finally {
      setActiveValidateId("");
    }
  };

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setIsSavingAdmin(true);

    try {
      const createdAdmin = await createAdminUser(adminForm);
      setToast({
        type: "success",
        title: "Admin created",
        message: `${createdAdmin.name} can now log in as an admin.`,
      });
      setAdminForm(createAdminForm());
      await loadAdmins();
    } catch (requestError) {
      setToast({
        type: "error",
        title: "Admin creation failed",
        message: getApiErrorMessage(requestError, "Could not create admin."),
      });
    } finally {
      setIsSavingAdmin(false);
    }
  };

  return (
    <section style={styles.page}>
      <Toast onDismiss={() => setToast(null)} toast={toast} />

      <div>
        <h1 style={{ marginBottom: "8px", color: "#102a43" }}>
          {isSuperAdmin ? "Super Admin Console" : "Admin Operations"}
        </h1>
        <p style={{ margin: 0, color: "#486581", lineHeight: 1.7 }}>
          {isSuperAdmin
            ? "Manage admins, watch booking activity, and keep platform inventory healthy."
            : "Monitor bookings, validate arrivals, and manage your parking slots with images and maintenance status."}
        </p>
      </div>

      <div style={styles.summaryGrid}>
        <article style={styles.summaryCard}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
            Managed slots
          </strong>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
            {summary.slotCount}
          </span>
        </article>
        <article style={styles.summaryCard}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
            Selected day bookings
          </strong>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
            {summary.todayBookings}
          </span>
        </article>
        <article style={styles.summaryCard}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
            Pending validation
          </strong>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
            {summary.pendingValidation}
          </span>
        </article>
        <article style={styles.summaryCard}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
            Maintenance slots
          </strong>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
            {summary.maintenanceSlots}
          </span>
        </article>
        {isSuperAdmin ? (
          <article style={styles.summaryCard}>
            <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
              Active admins
            </strong>
            <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#102a43" }}>
              {summary.admins}
            </span>
          </article>
        ) : null}
      </div>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={{ margin: "0 0 8px", color: "#102a43" }}>
              Analytics Dashboard
            </h2>
            <p style={{ margin: 0, color: "#486581", lineHeight: 1.6 }}>
              Track revenue, occupancy, peak booking windows, and cancellation patterns for your managed inventory.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <select
              onChange={(event) => setAnalyticsWindowDays(event.target.value)}
              style={styles.input}
              value={analyticsWindowDays}
            >
              {ANALYTICS_WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadManagedAnalytics(analyticsWindowDays)}
              style={styles.secondaryButton}
              type="button"
            >
              Refresh Analytics
            </button>
          </div>
        </div>

        {isLoadingAnalytics ? (
          <Loader label="Loading analytics..." />
        ) : (
          <>
            <p style={{ ...styles.text, marginBottom: "18px" }}>
              Window: {formatShortDate(analytics.range.startDate)} to{" "}
              {formatShortDate(analytics.range.endDate)} | Timezone:{" "}
              {analytics.range.timezone ?? "Local"}
            </p>

            <div style={styles.analyticsGrid}>
              <article style={styles.summaryCard}>
                <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
                  Revenue
                </strong>
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#102a43" }}>
                  {formatCurrency(analytics.summary.totalRevenue)}
                </span>
                <p style={styles.text}>
                  Avg/day: {formatCurrency(analytics.summary.averageDailyRevenue)}
                </p>
              </article>
              <article style={styles.summaryCard}>
                <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
                  Occupancy
                </strong>
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#102a43" }}>
                  {formatPercent(analytics.summary.occupancyRate)}
                </span>
                <p style={styles.text}>
                  {formatMetricNumber(analytics.summary.bookedHours)} of{" "}
                  {formatMetricNumber(analytics.summary.capacityHours)} slot-hours used
                </p>
              </article>
              <article style={styles.summaryCard}>
                <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
                  Cancellation Rate
                </strong>
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#102a43" }}>
                  {formatPercent(analytics.summary.cancellationRate)}
                </span>
                <p style={styles.text}>
                  {analytics.summary.cancelledBookings} cancelled of{" "}
                  {analytics.summary.totalBookings} scheduled bookings
                </p>
              </article>
              <article style={styles.summaryCard}>
                <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
                  Validation Rate
                </strong>
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#102a43" }}>
                  {formatPercent(analytics.summary.validationRate)}
                </span>
                <p style={styles.text}>
                  {analytics.summary.validatedBookings} validated bookings
                </p>
              </article>
              <article style={styles.summaryCard}>
                <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
                  Active Inventory
                </strong>
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#102a43" }}>
                  {analytics.summary.activeConfiguredSpots}
                </span>
                <p style={styles.text}>
                  Across {analytics.summary.activeSlots} active slots
                </p>
              </article>
              <article style={styles.summaryCard}>
                <strong style={{ display: "block", marginBottom: "6px", color: "#486581" }}>
                  Maintenance Load
                </strong>
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#102a43" }}>
                  {analytics.summary.maintenanceSlots}
                </span>
                <p style={styles.text}>
                  Managed slots: {analytics.summary.managedSlots}
                </p>
              </article>
            </div>

            <div style={styles.analyticsPanels}>
              <article style={styles.listCard}>
                <h3 style={{ margin: "0 0 8px", color: "#102a43" }}>
                  Daily Revenue
                </h3>
                <p style={styles.text}>
                  Revenue scheduled by booking start day in the selected window.
                </p>
                <div style={styles.miniRows}>
                  {analytics.dailyRevenue.map((entry) => (
                    <div key={entry.date} style={styles.miniRow}>
                      <div style={styles.miniRowTop}>
                        <strong style={{ color: "#102a43" }}>
                          {formatShortDate(entry.date)}
                        </strong>
                        <span style={{ color: "#486581" }}>
                          {entry.bookings} bookings | {formatCurrency(entry.revenue)}
                        </span>
                      </div>
                      <div style={styles.barTrack}>
                        <div
                          style={getBarFillStyle(
                            Number(entry.revenue) || 0,
                            revenueBarMaximum,
                            "linear-gradient(90deg, #0f766e, #14b8a6)"
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article style={styles.listCard}>
                <h3 style={{ margin: "0 0 8px", color: "#102a43" }}>
                  Peak Hours
                </h3>
                <p style={styles.text}>
                  The busiest booking start windows across your managed inventory.
                </p>
                {analytics.peakHours.length === 0 ? (
                  <p style={{ ...styles.text, marginTop: "14px" }}>
                    No booking peaks yet for this window.
                  </p>
                ) : (
                  <div style={styles.miniRows}>
                    {analytics.peakHours.map((entry) => (
                      <div key={entry.hour} style={styles.miniRow}>
                        <div style={styles.miniRowTop}>
                          <strong style={{ color: "#102a43" }}>{entry.label}</strong>
                          <span style={{ color: "#486581" }}>
                            {entry.bookingCount} bookings |{" "}
                            {formatCurrency(entry.revenue)}
                          </span>
                        </div>
                        <div style={styles.barTrack}>
                          <div
                            style={getBarFillStyle(
                              Number(entry.bookingCount) || 0,
                              peakHourBarMaximum,
                              "linear-gradient(90deg, #1d4ed8, #60a5fa)"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article style={styles.listCard}>
                <h3 style={{ margin: "0 0 8px", color: "#102a43" }}>
                  Cancellation Trend
                </h3>
                <p style={styles.text}>
                  Daily cancelled bookings based on when the cancellation happened.
                </p>
                <div style={styles.miniRows}>
                  {analytics.cancellationTrend.map((entry) => (
                    <div key={entry.date} style={styles.miniRow}>
                      <div style={styles.miniRowTop}>
                        <strong style={{ color: "#102a43" }}>
                          {formatShortDate(entry.date)}
                        </strong>
                        <span style={{ color: "#486581" }}>
                          {entry.cancelledBookings} cancellations
                        </span>
                      </div>
                      <div style={styles.barTrack}>
                        <div
                          style={getBarFillStyle(
                            Number(entry.cancelledBookings) || 0,
                            cancellationBarMaximum,
                            "linear-gradient(90deg, #b45309, #f59e0b)"
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </>
        )}
      </section>

      <div style={styles.grid}>
        <div style={styles.column}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={{ margin: "0 0 8px", color: "#102a43" }}>
                  {editingSlotId ? "Edit Parking Slot" : "Add Parking Slot"}
                </h2>
                <p style={{ margin: 0, color: "#486581", lineHeight: 1.6 }}>
                  Add images, set the location, choose VIP or accessible spot counts, and mark damaged slots as maintenance.
                </p>
              </div>
              {editingSlotId ? (
                <button
                  onClick={handleParkingReset}
                  style={styles.secondaryButton}
                  type="button"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSaveSlot}>
              <div style={styles.formGrid}>
                <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                  Title
                  <input
                    name="title"
                    onChange={handleParkingInputChange}
                    required
                    style={styles.input}
                    type="text"
                    value={parkingForm.title}
                  />
                </label>
                <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                  Address
                  <input
                    name="address"
                    onChange={handleParkingInputChange}
                    required
                    style={styles.input}
                    type="text"
                    value={parkingForm.address}
                  />
                </label>
                <div
                  style={{
                    ...styles.listCard,
                    display: "flex",
                    gap: "14px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gridColumn: "1 / -1",
                  }}
                >
                  {parkingFormImagePreviewUrl ? (
                    <img
                      alt={parkingForm.title || "Parking slot preview"}
                      src={parkingFormImagePreviewUrl}
                      style={styles.media}
                    />
                  ) : (
                    <div
                      style={{
                        ...styles.media,
                        display: "grid",
                        placeItems: "center",
                        color: "#486581",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        textAlign: "center",
                        padding: "10px",
                      }}
                    >
                      Upload a real slot photo
                    </div>
                  )}
                  <div style={{ flex: "1 1 240px", display: "grid", gap: "10px" }}>
                    <label style={styles.label}>
                      Upload image
                      <input
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        key={parkingImageInputKey}
                        onChange={handleParkingImageChange}
                        style={styles.input}
                        type="file"
                      />
                    </label>
                    <p style={{ ...styles.text, margin: 0 }}>
                      {parkingForm.imageFileName
                        ? `Selected file: ${parkingForm.imageFileName}`
                        : parkingForm.imageUrl
                          ? "Using the current slot image until you upload a replacement."
                          : "PNG, JPG, WEBP, or GIF up to 5 MB."}
                    </p>
                    {(parkingForm.imageData || parkingForm.imageUrl) ? (
                      <div style={styles.buttons}>
                        <button
                          onClick={handleClearParkingImage}
                          style={styles.secondaryButton}
                          type="button"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                  External image URL
                  <input
                    name="imageUrl"
                    onChange={handleParkingInputChange}
                    placeholder="https://example.com/parking.jpg"
                    style={styles.input}
                    type="url"
                    value={parkingForm.imageUrl}
                  />
                </label>
                <label style={styles.label}>
                  Latitude
                  <input
                    max="90"
                    min="-90"
                    name="lat"
                    onChange={handleParkingInputChange}
                    required
                    step="any"
                    style={styles.input}
                    type="number"
                    value={parkingForm.lat}
                  />
                </label>
                <label style={styles.label}>
                  Longitude
                  <input
                    max="180"
                    min="-180"
                    name="lng"
                    onChange={handleParkingInputChange}
                    required
                    step="any"
                    style={styles.input}
                    type="number"
                    value={parkingForm.lng}
                  />
                </label>
                <label style={styles.label}>
                  Price per hour
                  <input
                    min="1"
                    name="pricePerHour"
                    onChange={handleParkingInputChange}
                    required
                    style={styles.input}
                    type="number"
                    value={parkingForm.pricePerHour}
                  />
                </label>
                <label style={styles.label}>
                  Available slots
                  <input
                    min="0"
                    name="availableSlots"
                    onChange={handleParkingInputChange}
                    required
                    style={styles.input}
                    type="number"
                    value={parkingForm.availableSlots}
                  />
                </label>
                <label style={styles.label}>
                  Accessible spots
                  <input
                    min="0"
                    name="accessibleSpotCount"
                    onChange={handleParkingInputChange}
                    style={styles.input}
                    type="number"
                    value={parkingForm.accessibleSpotCount}
                  />
                </label>
                <label style={styles.label}>
                  VIP spots
                  <input
                    min="0"
                    name="vipSpotCount"
                    onChange={handleParkingInputChange}
                    style={styles.input}
                    type="number"
                    value={parkingForm.vipSpotCount}
                  />
                </label>
                <label style={styles.label}>
                  Slot status
                  <select
                    name="status"
                    onChange={handleParkingInputChange}
                    style={styles.input}
                    value={parkingForm.status}
                  >
                    {Object.entries(PARKING_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p style={{ ...styles.text, marginTop: "14px" }}>
                Accessible and VIP spot counts are part of the configured total.
              </p>

              <div style={styles.buttons}>
                <button
                  disabled={isSavingSlot}
                  style={styles.primaryButton}
                  type="submit"
                >
                  {isSavingSlot
                    ? editingSlotId
                      ? "Updating..."
                      : "Saving..."
                    : editingSlotId
                    ? "Update Slot"
                    : "Create Slot"}
                </button>
                <button
                  onClick={handleParkingReset}
                  style={styles.secondaryButton}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          <ParkingMap
            emptyLabel="Add a parking slot with valid coordinates to start monitoring the map."
            onSelect={setSelectedSlotId}
            selectedSlotId={selectedSlotId}
            slots={slots}
            subtitle={
              isSuperAdmin
                ? "Track how your admins' inventory is spread across the city."
                : "Track how your managed inventory is spread across the city."
            }
            title={isSuperAdmin ? "Platform Inventory Map" : "Managed Inventory Map"}
          />
        </div>

        <div style={styles.column}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={{ margin: "0 0 8px", color: "#102a43" }}>
                  Booking Validation Desk
                </h2>
                <p style={{ margin: 0, color: "#486581", lineHeight: 1.6 }}>
                  Review the selected day's bookings and validate arrivals.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  max={getLocalDateValue()}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  style={styles.input}
                  type="date"
                  value={selectedDate}
                />
                <button
                  onClick={() => loadManagedBookings(selectedDate)}
                  style={styles.secondaryButton}
                  type="button"
                >
                  Refresh
                </button>
              </div>
            </div>

            {isLoadingBookings ? (
              <Loader label="Loading managed bookings..." />
            ) : bookings.length === 0 ? (
              <p style={styles.text}>
                No bookings overlap this day for the slots you manage.
              </p>
            ) : (
              <div style={styles.list}>
                {bookings.map((booking) => {
                  const canValidate =
                    booking.status === "booked" &&
                    booking.validationStatus === "pending";

                  return (
                    <article key={booking._id} style={styles.listCard}>
                      <div style={styles.badgeRow}>
                        <span
                          style={getBadgeStyle(
                            booking.status === "cancelled"
                              ? "danger"
                              : booking.status === "completed"
                              ? "warning"
                              : "success"
                          )}
                        >
                          {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                        <span
                          style={getBadgeStyle(
                            booking.status === "cancelled"
                              ? getCancellationTone(booking.cancellationReason)
                              : booking.validationStatus === "validated"
                              ? "success"
                              : booking.validationStatus === "expired"
                              ? "warning"
                              : "warning"
                          )}
                        >
                          {booking.status === "cancelled"
                            ? BOOKING_CANCELLATION_REASON_LABELS[
                                booking.cancellationReason
                              ] ?? "Cancelled"
                            : BOOKING_VALIDATION_LABELS[
                                booking.validationStatus
                              ] ?? booking.validationStatus}
                        </span>
                      </div>
                      <h3 style={{ margin: "0 0 8px", color: "#102a43" }}>
                        {booking.parkingSlot?.title ?? "Parking Slot"}
                      </h3>
                      <p style={styles.text}>
                        Customer: {booking.user?.name ?? "Unknown user"}
                        {booking.user?.email ? ` | ${booking.user.email}` : ""}
                      </p>
                      <p style={styles.text}>
                        Spot: {booking.parkingSpot?.label ?? "Assigned on arrival"}
                      </p>
                      <p style={styles.text}>
                        Preference:{" "}
                        {BOOKING_SPOT_PREFERENCE_LABELS[booking.spotPreference] ??
                          booking.spotPreference ??
                          "Nearest Available"}
                      </p>
                      {booking.parkingSpot?.spotType ? (
                        <p style={styles.text}>
                          Assigned type:{" "}
                          {PARKING_SPOT_TYPE_LABELS[booking.parkingSpot.spotType] ??
                            booking.parkingSpot.spotType}
                          {booking.parkingSpot.distanceFromEntrance != null
                            ? ` | Entrance rank #${booking.parkingSpot.distanceFromEntrance}`
                            : ""}
                        </p>
                      ) : null}
                      <p style={styles.text}>From: {formatDateTime(booking.startTime)}</p>
                      <p style={styles.text}>To: {formatDateTime(booking.endTime)}</p>
                      <p style={styles.text}>Total price: Rs. {booking.totalPrice ?? 0}</p>
                      {booking.status === "booked" &&
                      booking.validationStatus === "pending" &&
                      booking.expiresAt ? (
                        <p style={styles.text}>
                          Validate by: {formatDateTime(booking.expiresAt)}
                        </p>
                      ) : null}
                      {isSuperAdmin ? (
                        <p style={styles.text}>
                          Slot owner: {booking.parkingSlot?.owner?.name ?? "Unknown admin"}
                        </p>
                      ) : null}
                      {booking.status === "cancelled" && booking.cancelledAt ? (
                        <p style={styles.text}>
                          {BOOKING_CANCELLATION_REASON_LABELS[
                            booking.cancellationReason
                          ] ?? "Cancelled"} on {formatDateTime(booking.cancelledAt)}
                        </p>
                      ) : null}
                      {booking.validationStatus === "validated" ? (
                        <p style={styles.text}>
                          Validated by: {booking.validatedBy?.name ?? "Admin"} on{" "}
                          {formatDateTime(booking.validatedAt)}
                        </p>
                      ) : null}
                      {canValidate ? (
                        <div style={styles.buttons}>
                          <button
                            disabled={activeValidateId === booking._id}
                            onClick={() => handleValidateBooking(booking._id)}
                            style={styles.primaryButton}
                            type="button"
                          >
                            {activeValidateId === booking._id
                              ? "Validating..."
                              : "Validate Arrival"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={{ margin: "0 0 8px", color: "#102a43" }}>
                  Managed Inventory
                </h2>
                <p style={{ margin: 0, color: "#486581", lineHeight: 1.6 }}>
                  Edit prices, images, and slot health before users book.
                </p>
              </div>
            </div>

            {isLoadingSlots ? (
              <Loader label="Loading parking inventory..." />
            ) : slots.length === 0 ? (
              <p style={styles.text}>
                You have no parking slots yet. Create one to start taking bookings.
              </p>
            ) : (
              <div style={styles.list}>
                {slots.map((slot) => (
                  <article
                    key={slot._id}
                    style={{
                      ...styles.listCard,
                      border:
                        slot._id === editingSlotId
                          ? "1px solid rgba(15, 118, 110, 0.35)"
                          : styles.listCard.border,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      {slot.imageUrl ? (
                        <img
                          alt={slot.title}
                          src={resolveParkingImageUrl(slot.imageUrl)}
                          style={styles.media}
                        />
                      ) : (
                        <div
                          style={{
                            ...styles.media,
                            display: "grid",
                            placeItems: "center",
                            color: "#486581",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            textAlign: "center",
                            padding: "10px",
                          }}
                        >
                          Add a slot image
                        </div>
                      )}
                      <div style={{ flex: "1 1 240px" }}>
                        <div style={styles.badgeRow}>
                          <span style={getBadgeStyle(getParkingTone(slot.status))}>
                            {PARKING_STATUS_LABELS[slot.status] ?? slot.status}
                          </span>
                          <span style={getBadgeStyle("success")}>
                            {slot.availableSlots ?? 0} configured spots
                          </span>
                        </div>
                        <h3 style={{ margin: "0 0 8px", color: "#102a43" }}>
                          {slot.title}
                        </h3>
                        <p style={styles.text}>{getLocationText(slot)}</p>
                        <p style={styles.text}>Price: Rs. {slot.pricePerHour}/hour</p>
                        <p style={styles.text}>
                          Spot mix: {formatSpotMix(getConfiguredSpotMix(slot)) || "Standard only"}
                        </p>
                        <p style={styles.text}>
                          Coordinates: {slot.location?.lat ?? "--"}, {slot.location?.lng ?? "--"}
                        </p>
                        {isSuperAdmin ? (
                          <p style={styles.text}>
                            Owner: {slot.owner?.name ?? "Unknown admin"}
                            {slot.owner?.email ? ` | ${slot.owner.email}` : ""}
                          </p>
                        ) : null}
                        <div style={styles.buttons}>
                          <button
                            onClick={() => setSelectedSlotId(slot._id)}
                            style={styles.subtleButton}
                            type="button"
                          >
                            Focus on Map
                          </button>
                          <button
                            onClick={() => handleEditSlot(slot)}
                            style={styles.secondaryButton}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            disabled={activeDeleteId === slot._id}
                            onClick={() => handleDeleteSlot(slot._id)}
                            style={styles.dangerButton}
                            type="button"
                          >
                            {activeDeleteId === slot._id ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {isSuperAdmin ? (
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={{ margin: "0 0 8px", color: "#102a43" }}>
                    Admin Management
                  </h2>
                  <p style={{ margin: 0, color: "#486581", lineHeight: 1.6 }}>
                    Create admins for new parking operators and track platform access.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateAdmin}>
                <div style={styles.formGrid}>
                  <label style={styles.label}>
                    Name
                    <input
                      name="name"
                      onChange={handleAdminInputChange}
                      required
                      style={styles.input}
                      type="text"
                      value={adminForm.name}
                    />
                  </label>
                  <label style={styles.label}>
                    Email
                    <input
                      name="email"
                      onChange={handleAdminInputChange}
                      required
                      style={styles.input}
                      type="email"
                      value={adminForm.email}
                    />
                  </label>
                  <label style={styles.label}>
                    Password
                    <input
                      minLength="6"
                      name="password"
                      onChange={handleAdminInputChange}
                      required
                      style={styles.input}
                      type="password"
                      value={adminForm.password}
                    />
                  </label>
                </div>

                <div style={styles.buttons}>
                  <button
                    disabled={isSavingAdmin}
                    style={styles.primaryButton}
                    type="submit"
                  >
                    {isSavingAdmin ? "Creating..." : "Create Admin"}
                  </button>
                  <button
                    onClick={() => setAdminForm(createAdminForm())}
                    style={styles.secondaryButton}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </form>

              <div style={{ marginTop: "22px" }}>
                {isLoadingAdmins ? (
                  <Loader label="Loading admins..." />
                ) : admins.length === 0 ? (
                  <p style={styles.text}>No admins have been added yet.</p>
                ) : (
                  <div style={styles.list}>
                    {admins.map((admin) => (
                      <article key={admin._id ?? admin.id} style={styles.listCard}>
                        <div style={styles.badgeRow}>
                          <span
                            style={getBadgeStyle(
                              admin.role === "super_admin" ? "warning" : "success"
                            )}
                          >
                            {ROLE_LABELS[admin.role] ?? admin.role}
                          </span>
                        </div>
                        <h3 style={{ margin: "0 0 8px", color: "#102a43" }}>
                          {admin.name}
                        </h3>
                        <p style={styles.text}>{admin.email}</p>
                        <p style={styles.text}>Added: {formatDateTime(admin.createdAt)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default AdminPage;
