import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import ParkingSlot from "../models/ParkingSlot.js";
import User from "../models/User.js";
import { runBookingLifecycleMaintenance } from "../utils/bookingLifecycle.js";
import { emitBookingChanged } from "../utils/realtime.js";

const ANALYTICS_DEFAULT_DAYS = 7;
const ANALYTICS_MAX_DAYS = 90;
const DEFAULT_ANALYTICS_TIMEZONE = "UTC";
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;
const REVENUE_BOOKING_STATUSES = ["booked", "completed"];

const parseDateValue = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const resolveAnalyticsTimezone = (timezoneValue) => {
  if (typeof timezoneValue !== "string" || !timezoneValue.trim()) {
    return DEFAULT_ANALYTICS_TIMEZONE;
  }

  try {
    Intl.DateTimeFormat("en-US", {
      timeZone: timezoneValue.trim(),
    }).format(new Date());

    return timezoneValue.trim();
  } catch {
    return DEFAULT_ANALYTICS_TIMEZONE;
  }
};

const parseDateOnlyUtcRange = (dateValue) => {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue ?? "");

  if (!dateParts) {
    return null;
  }

  const [, year, month, day] = dateParts;
  const start = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
};

const buildManagedDayRange = ({ dateValue, dayEndValue, dayStartValue }) => {
  const explicitStart = parseDateValue(dayStartValue);
  const explicitEnd = parseDateValue(dayEndValue);

  if (explicitStart && explicitEnd && explicitStart < explicitEnd) {
    return {
      start: explicitStart,
      end: explicitEnd,
    };
  }

  const parsedDateOnlyRange = parseDateOnlyUtcRange(dateValue);

  if (parsedDateOnlyRange) {
    return parsedDateOnlyRange;
  }

  const baseDate = new Date();
  const fallbackDateRange = parseDateOnlyUtcRange(
    baseDate.toISOString().slice(0, 10)
  );

  if (!fallbackDateRange) {
    return null;
  }

  return fallbackDateRange;
};

export const adminControllerDependencies = {
  emitBookingChanged,
  runBookingLifecycleMaintenance,
};

const buildManagedAnalyticsRange = ({
  daysValue,
  endDateValue,
  startDateValue,
  timezoneValue,
}) => {
  const parsedDays = Number(daysValue);
  const hasExplicitDayCount =
    Number.isInteger(parsedDays) && parsedDays > 0
      ? true
      : false;
  const days = hasExplicitDayCount
    ? Math.min(parsedDays, ANALYTICS_MAX_DAYS)
    : ANALYTICS_DEFAULT_DAYS;
  const timezone = resolveAnalyticsTimezone(timezoneValue);
  const explicitStart = parseDateValue(startDateValue);
  const explicitEnd = parseDateValue(endDateValue);

  if (explicitStart && explicitEnd && explicitStart < explicitEnd) {
    const derivedDays = Math.max(
      Math.ceil((explicitEnd.getTime() - explicitStart.getTime()) / MS_PER_DAY),
      1
    );

    return {
      start: explicitStart,
      end: explicitEnd,
      days: hasExplicitDayCount
        ? days
        : Math.min(derivedDays, ANALYTICS_MAX_DAYS),
      timezone,
    };
  }

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return { start, end, days, timezone };
};

const toIsoDateKey = (dateValue, timezone) => {
  const date = parseDateValue(dateValue);

  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
};

const buildDateKeys = (range) =>
  Array.from({ length: range.days }, (_, index) => {
    const nextDate = new Date(
      range.start.getTime() + index * MS_PER_DAY + 12 * MS_PER_HOUR
    );

    return toIsoDateKey(nextDate, range.timezone);
  });

const formatHourLabel = (hour) => {
  const startHour = hour % 12 || 12;
  const endHour = (hour + 1) % 24;
  const endHourLabel = endHour % 12 || 12;
  const startSuffix = hour < 12 ? "AM" : "PM";
  const endSuffix = endHour < 12 ? "AM" : "PM";

  return `${startHour} ${startSuffix} - ${endHourLabel} ${endSuffix}`;
};

const toPercentage = (value) =>
  Number.isFinite(value) ? Number(value.toFixed(1)) : 0;

const roundMetric = (value) =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

const buildSlotSummary = (parkingSlots) => ({
  managedSlots: parkingSlots.length,
  activeSlots: parkingSlots.filter((slot) => slot.status === "active").length,
  maintenanceSlots: parkingSlots.filter((slot) => slot.status === "maintenance")
    .length,
  totalConfiguredSpots: parkingSlots.reduce(
    (runningTotal, slot) => runningTotal + (Number(slot.availableSlots) || 0),
    0
  ),
  activeConfiguredSpots: parkingSlots
    .filter((slot) => slot.status === "active")
    .reduce(
      (runningTotal, slot) => runningTotal + (Number(slot.availableSlots) || 0),
      0
    ),
});

const buildZeroFilledSeries = (dateKeys, fieldName) =>
  dateKeys.map((dateKey) => ({
    date: dateKey,
    [fieldName]: 0,
  }));

const mergeSeriesByDate = (dateKeys, rows, valueKeys) =>
  dateKeys.map((dateKey) => {
    const matchingRow = rows.find((row) => row.date === dateKey);
    const nextRow = { date: dateKey };

    for (const key of valueKeys) {
      nextRow[key] = matchingRow?.[key] ?? 0;
    }

    return nextRow;
  });

const buildEmptyAnalyticsResponse = (range, slotSummary) => {
  const capacityHours = roundMetric(
    slotSummary.activeConfiguredSpots * range.days * 24
  );
  const dateKeys = buildDateKeys(range);

  return {
    range: {
      days: range.days,
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
      timezone: range.timezone,
    },
    summary: {
      managedSlots: slotSummary.managedSlots,
      activeSlots: slotSummary.activeSlots,
      maintenanceSlots: slotSummary.maintenanceSlots,
      totalConfiguredSpots: slotSummary.totalConfiguredSpots,
      activeConfiguredSpots: slotSummary.activeConfiguredSpots,
      totalBookings: 0,
      cancelledBookings: 0,
      validatedBookings: 0,
      totalRevenue: 0,
      averageDailyRevenue: 0,
      bookedHours: 0,
      capacityHours,
      occupancyRate: 0,
      cancellationRate: 0,
      validationRate: 0,
    },
    dailyRevenue: mergeSeriesByDate(
      dateKeys,
      buildZeroFilledSeries(dateKeys, "revenue").map((row) => ({
        ...row,
        bookings: 0,
      })),
      ["revenue", "bookings"]
    ),
    cancellationTrend: mergeSeriesByDate(
      dateKeys,
      buildZeroFilledSeries(dateKeys, "cancelledBookings"),
      ["cancelledBookings"]
    ),
    peakHours: [],
  };
};

const getManagedParkingIds = async (user) => {
  const filters = user.role === "super_admin" ? {} : { owner: user.id };
  const parkingSlots = await ParkingSlot.find(filters).select("_id");
  return parkingSlots.map((slot) => slot._id);
};

const getManagedParkingSlots = async (user) => {
  const filters = user.role === "super_admin" ? {} : { owner: user.id };
  return ParkingSlot.find(filters).select("_id availableSlots status owner");
};

const populateManagedBooking = (query) =>
  query
    .populate("user", "name email")
    .populate(
      "parkingSlot",
      "title imageUrl status location pricePerHour availableSlots allocationConfig owner"
    )
    .populate(
      "parkingSpot",
      "spotNumber label spotType distanceFromEntrance isActive"
    )
    .populate("validatedBy", "name email role");

export const getManagedBookings = async (req, res, next) => {
  try {
    await adminControllerDependencies.runBookingLifecycleMaintenance({
      silent: true,
    });
    const dayRange = buildManagedDayRange({
      dateValue: req.query.date,
      dayEndValue: req.query.dayEnd,
      dayStartValue: req.query.dayStart,
    });

    if (!dayRange) {
      return res.status(400).json({ message: "Invalid date query" });
    }

    const managedParkingIds = await getManagedParkingIds(req.user);

    if (managedParkingIds.length === 0) {
      return res.status(200).json({
        bookings: [],
        summary: {
          total: 0,
          pendingValidation: 0,
          validated: 0,
        },
      });
    }

    const bookings = await populateManagedBooking(
      Booking.find({
        parkingSlot: { $in: managedParkingIds },
        startTime: { $lt: dayRange.end },
        endTime: { $gt: dayRange.start },
      }).sort({ startTime: 1, createdAt: 1 })
    );

    return res.status(200).json({
      bookings,
      summary: {
        total: bookings.length,
        pendingValidation: bookings.filter(
          (booking) =>
            booking.status === "booked" &&
            booking.validationStatus === "pending"
        ).length,
        validated: bookings.filter(
          (booking) => booking.validationStatus === "validated"
        ).length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const validateManagedBooking = async (req, res, next) => {
  try {
    await adminControllerDependencies.runBookingLifecycleMaintenance({
      silent: true,
    });
    const bookingId = req.params.id?.trim();

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: "Invalid bookingId" });
    }

    const booking = await Booking.findById(bookingId).populate(
      "parkingSlot",
      "owner title"
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const ownsBookingSlot =
      req.user.role === "super_admin" ||
      booking.parkingSlot?.owner?.toString() === req.user.id;

    if (!ownsBookingSlot) {
      return res.status(403).json({
        message: "You can only validate bookings for your own parking slots",
      });
    }

    if (booking.status !== "booked") {
      return res.status(400).json({
        message: "Only active bookings can be validated",
      });
    }

    if (booking.validationStatus === "validated") {
      return res.status(400).json({
        message: "Booking is already validated",
      });
    }

    booking.validationStatus = "validated";
    booking.validatedAt = new Date();
    booking.validatedBy = req.user.id;
    await booking.save();

    const populatedBooking = await populateManagedBooking(
      Booking.findById(booking._id)
    );

    adminControllerDependencies.emitBookingChanged({
      bookingId: booking._id,
      parkingSlotId: booking.parkingSlot?._id ?? booking.parkingSlot,
      reason: "validated",
    });

    return res.status(200).json({
      message: "Booking validated successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    return next(error);
  }
};

export const getManagedAnalytics = async (req, res, next) => {
  try {
    await adminControllerDependencies.runBookingLifecycleMaintenance({
      silent: true,
    });
    const range = buildManagedAnalyticsRange({
      daysValue: req.query.days,
      endDateValue: req.query.endDate,
      startDateValue: req.query.startDate,
      timezoneValue: req.query.timezone,
    });
    const managedParkingSlots = await getManagedParkingSlots(req.user);
    const slotSummary = buildSlotSummary(managedParkingSlots);
    const managedParkingIds = managedParkingSlots.map((slot) => slot._id);

    if (managedParkingIds.length === 0) {
      return res.status(200).json(buildEmptyAnalyticsResponse(range, slotSummary));
    }

    const [summaryRows, occupancyRows, dailyRevenueRows, peakHourRows, cancellationRows] =
      await Promise.all([
        Booking.aggregate([
          {
            $match: {
              parkingSlot: { $in: managedParkingIds },
              startTime: {
                $gte: range.start,
                $lte: range.end,
              },
            },
          },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              cancelledBookings: {
                $sum: {
                  $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
                },
              },
              validatedBookings: {
                $sum: {
                  $cond: [{ $eq: ["$validationStatus", "validated"] }, 1, 0],
                },
              },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $in: ["$status", REVENUE_BOOKING_STATUSES] },
                    "$totalPrice",
                    0,
                  ],
                },
              },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              parkingSlot: { $in: managedParkingIds },
              status: { $in: REVENUE_BOOKING_STATUSES },
              startTime: { $lt: range.end },
              endTime: { $gt: range.start },
            },
          },
          {
            $project: {
              effectiveStart: {
                $cond: [
                  { $gt: ["$startTime", range.start] },
                  "$startTime",
                  range.start,
                ],
              },
              effectiveEnd: {
                $cond: [
                  { $lt: ["$endTime", range.end] },
                  "$endTime",
                  range.end,
                ],
              },
            },
          },
          {
            $project: {
              bookedHours: {
                $divide: [
                  {
                    $max: [
                      0,
                      {
                        $subtract: ["$effectiveEnd", "$effectiveStart"],
                      },
                    ],
                  },
                  MS_PER_HOUR,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              bookedHours: { $sum: "$bookedHours" },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              parkingSlot: { $in: managedParkingIds },
              status: { $in: REVENUE_BOOKING_STATUSES },
              startTime: {
                $gte: range.start,
                $lte: range.end,
              },
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$startTime",
                    timezone: range.timezone,
                  },
                },
              },
              revenue: { $sum: "$totalPrice" },
              bookings: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              date: "$_id.date",
              revenue: { $round: ["$revenue", 2] },
              bookings: 1,
            },
          },
          { $sort: { date: 1 } },
        ]),
        Booking.aggregate([
          {
            $match: {
              parkingSlot: { $in: managedParkingIds },
              status: { $in: REVENUE_BOOKING_STATUSES },
              startTime: {
                $gte: range.start,
                $lte: range.end,
              },
            },
          },
          {
            $group: {
              _id: {
                hour: {
                  $hour: {
                    date: "$startTime",
                    timezone: range.timezone,
                  },
                },
              },
              bookingCount: { $sum: 1 },
              revenue: { $sum: "$totalPrice" },
            },
          },
          {
            $project: {
              _id: 0,
              hour: "$_id.hour",
              bookingCount: 1,
              revenue: { $round: ["$revenue", 2] },
            },
          },
          { $sort: { bookingCount: -1, revenue: -1, hour: 1 } },
          { $limit: 5 },
        ]),
        Booking.aggregate([
          {
            $match: {
              parkingSlot: { $in: managedParkingIds },
              status: "cancelled",
            },
          },
          {
            $addFields: {
              cancellationMoment: {
                $ifNull: ["$cancelledAt", "$updatedAt"],
              },
            },
          },
          {
            $match: {
              cancellationMoment: {
                $gte: range.start,
                $lte: range.end,
              },
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$cancellationMoment",
                    timezone: range.timezone,
                  },
                },
              },
              cancelledBookings: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              date: "$_id.date",
              cancelledBookings: 1,
            },
          },
          { $sort: { date: 1 } },
        ]),
      ]);

    const summaryRow = summaryRows[0] ?? {};
    const occupancyRow = occupancyRows[0] ?? {};
    const totalRevenue = Number(summaryRow.totalRevenue ?? 0);
    const totalBookings = Number(summaryRow.totalBookings ?? 0);
    const cancelledBookings = Number(summaryRow.cancelledBookings ?? 0);
    const validatedBookings = Number(summaryRow.validatedBookings ?? 0);
    const bookedHours = Number(occupancyRow.bookedHours ?? 0);
    const capacityHours = slotSummary.activeConfiguredSpots * range.days * 24;
    const dateKeys = buildDateKeys(range);

    return res.status(200).json({
      range: {
        days: range.days,
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        timezone: range.timezone,
      },
      summary: {
        managedSlots: slotSummary.managedSlots,
        activeSlots: slotSummary.activeSlots,
        maintenanceSlots: slotSummary.maintenanceSlots,
        totalConfiguredSpots: slotSummary.totalConfiguredSpots,
        activeConfiguredSpots: slotSummary.activeConfiguredSpots,
        totalBookings,
        cancelledBookings,
        validatedBookings,
        totalRevenue: roundMetric(totalRevenue),
        averageDailyRevenue: roundMetric(totalRevenue / range.days),
        bookedHours: roundMetric(bookedHours),
        capacityHours: roundMetric(capacityHours),
        occupancyRate: toPercentage(
          capacityHours > 0 ? (bookedHours / capacityHours) * 100 : 0
        ),
        cancellationRate: toPercentage(
          totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0
        ),
        validationRate: toPercentage(
          totalBookings > 0 ? (validatedBookings / totalBookings) * 100 : 0
        ),
      },
      dailyRevenue: mergeSeriesByDate(dateKeys, dailyRevenueRows, [
        "revenue",
        "bookings",
      ]),
      cancellationTrend: mergeSeriesByDate(dateKeys, cancellationRows, [
        "cancelledBookings",
      ]),
      peakHours: peakHourRows.map((row) => ({
        ...row,
        label: formatHourLabel(row.hour),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const listAdmins = async (_req, res, next) => {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
      .select("name email role createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json(admins);
  } catch (error) {
    return next(error);
  }
};

export const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
    });

    return res.status(201).json({
      _id: admin._id,
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};
