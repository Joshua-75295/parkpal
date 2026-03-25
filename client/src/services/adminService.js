import API from "./api.js";

const ANALYTICS_DEFAULT_DAYS = 7;
const ANALYTICS_MAX_DAYS = 90;

const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const toDayRangeParams = (dateValue) => {
  const localDate = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();

  if (Number.isNaN(localDate.getTime())) {
    return {};
  }

  const dayStart = new Date(localDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(localDate);
  dayEnd.setHours(23, 59, 59, 999);

  return {
    dayEnd: dayEnd.toISOString(),
    dayStart: dayStart.toISOString(),
    timezone: getBrowserTimeZone(),
  };
};

const toAnalyticsRangeParams = (daysValue) => {
  const parsedDays = Number(daysValue);
  const days =
    Number.isInteger(parsedDays) && parsedDays > 0
      ? Math.min(parsedDays, ANALYTICS_MAX_DAYS)
      : ANALYTICS_DEFAULT_DAYS;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (days - 1));

  return {
    days,
    endDate: endDate.toISOString(),
    startDate: startDate.toISOString(),
    timezone: getBrowserTimeZone(),
  };
};

export const getTodayManagedBookings = async (date) => {
  const response = await API.get("/admin/bookings/today", {
    params: {
      ...(date ? { date } : {}),
      ...toDayRangeParams(date),
    },
  });

  return {
    bookings: Array.isArray(response.data?.bookings) ? response.data.bookings : [],
    summary: response.data?.summary ?? {
      total: 0,
      pendingValidation: 0,
      validated: 0,
    },
  };
};

export const getManagedAnalytics = async (days) => {
  const response = await API.get("/admin/analytics", {
    params: toAnalyticsRangeParams(days),
  });

  return {
    range: response.data?.range ?? {
      days: 7,
      startDate: null,
      endDate: null,
      timezone: "UTC",
    },
    summary: response.data?.summary ?? {
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
    dailyRevenue: Array.isArray(response.data?.dailyRevenue)
      ? response.data.dailyRevenue
      : [],
    cancellationTrend: Array.isArray(response.data?.cancellationTrend)
      ? response.data.cancellationTrend
      : [],
    peakHours: Array.isArray(response.data?.peakHours)
      ? response.data.peakHours
      : [],
  };
};

export const validateManagedBooking = async (bookingId) => {
  const response = await API.put(`/admin/bookings/${bookingId}/validate`);
  return response.data.booking ?? response.data;
};

export const getAdmins = async () => {
  const response = await API.get("/admin/users/admins");
  return Array.isArray(response.data) ? response.data : [];
};

export const createAdminUser = async (payload) => {
  const response = await API.post("/admin/users/admins", payload);
  return response.data;
};
