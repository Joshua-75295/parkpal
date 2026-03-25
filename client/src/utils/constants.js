export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export const AUTH_SESSION_EXPIRED_EVENT = "parkpal:auth-expired";
export const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_SERVER_URL ?? new URL(API_BASE_URL).origin;

export const REALTIME_EVENTS = Object.freeze({
  availabilityChanged: "parking:availability-changed",
  bookingChanged: "booking:changed",
  inventoryChanged: "parking:inventory-changed",
});

export const APP_ROUTES = Object.freeze({
  home: "/",
  login: "/login",
  register: "/register",
  search: "/search",
  bookings: "/my-bookings",
  admin: "/admin",
});

export const BOOKING_STATUS_LABELS = Object.freeze({
  booked: "Active",
  cancelled: "Cancelled",
  completed: "Completed",
});

export const BOOKING_VALIDATION_LABELS = Object.freeze({
  pending: "Pending Validation",
  validated: "Validated",
  expired: "Expired",
});

export const BOOKING_CANCELLATION_REASON_LABELS = Object.freeze({
  user_cancelled: "Cancelled by User",
  expired: "Expired After No-Show",
});

export const BOOKING_SPOT_PREFERENCE_LABELS = Object.freeze({
  nearest: "Nearest Available",
  standard: "Standard Spot",
  vip: "VIP Spot",
  accessible: "Accessible Spot",
});

export const PARKING_STATUS_LABELS = Object.freeze({
  active: "Active",
  maintenance: "Maintenance",
  inactive: "Inactive",
});

export const PARKING_SPOT_TYPE_LABELS = Object.freeze({
  standard: "Standard",
  vip: "VIP",
  accessible: "Accessible",
});

export const ROLE_LABELS = Object.freeze({
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
});

export const DEFAULT_MAP_CENTER = Object.freeze([20.5937, 78.9629]);
export const DEFAULT_MAP_ZOOM = 5;
