import Booking from "../models/Booking.js";
import {
  emitAvailabilityChanged,
  emitBookingChanged,
} from "./realtime.js";

const DEFAULT_BOOKING_EXPIRY_MINUTES = 15;

const getConfiguredBookingExpiryMinutes = () => {
  const configuredValue = Number(process.env.BOOKING_EXPIRY_MINUTES);

  if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
    return DEFAULT_BOOKING_EXPIRY_MINUTES;
  }

  return Math.floor(configuredValue);
};

export const getBookingExpiryMinutes = () =>
  getConfiguredBookingExpiryMinutes();

export const computeBookingExpiryTime = (startTime, endTime) => {
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const expiryMs =
    start.getTime() + getConfiguredBookingExpiryMinutes() * 60 * 1000;

  return new Date(Math.min(expiryMs, end.getTime()));
};

const ensurePendingBookingExpiryDeadlines = async () => {
  const bookingsMissingExpiry = await Booking.find({
    status: "booked",
    validationStatus: "pending",
    expiresAt: null,
  }).select("_id startTime endTime");

  if (bookingsMissingExpiry.length === 0) {
    return 0;
  }

  await Booking.bulkWrite(
    bookingsMissingExpiry
      .map((booking) => {
        const expiresAt = computeBookingExpiryTime(
          booking.startTime,
          booking.endTime
        );

        if (!expiresAt) {
          return null;
        }

        return {
          updateOne: {
            filter: { _id: booking._id },
            update: {
              $set: {
                expiresAt,
              },
            },
          },
        };
      })
      .filter(Boolean),
    { ordered: false }
  );

  return bookingsMissingExpiry.length;
};

const expirePendingBookings = async (now) => {
  const result = await Booking.updateMany(
    {
      status: "booked",
      validationStatus: "pending",
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: "cancelled",
        validationStatus: "expired",
        cancellationReason: "expired",
        cancelledAt: now,
      },
    }
  );

  return result.modifiedCount ?? 0;
};

const completeFinishedBookings = async (now) => {
  const result = await Booking.updateMany(
    {
      endTime: { $lt: now },
      status: "booked",
    },
    {
      $set: { status: "completed" },
    }
  );

  return result.modifiedCount ?? 0;
};

export const runBookingLifecycleMaintenance = async ({
  now = new Date(),
  silent = false,
} = {}) => {
  try {
    await ensurePendingBookingExpiryDeadlines();
    const expiredCount = await expirePendingBookings(now);
    const completedCount = await completeFinishedBookings(now);

    if (!silent && (expiredCount > 0 || completedCount > 0)) {
      console.log(
        `Booking lifecycle updated: ${expiredCount} expired, ${completedCount} completed`
      );
    }

    if (expiredCount > 0) {
      emitBookingChanged({
        reason: "expired-batch",
      });
      emitAvailabilityChanged({
        reason: "expired-batch",
      });
    }

    if (completedCount > 0) {
      emitBookingChanged({
        reason: "completed-batch",
      });
      emitAvailabilityChanged({
        reason: "completed-batch",
      });
    }

    return {
      expiredCount,
      completedCount,
    };
  } catch (error) {
    if (!silent) {
      console.error("Error updating booking lifecycle:", error.message);
    }

    return {
      expiredCount: 0,
      completedCount: 0,
      error,
    };
  }
};
