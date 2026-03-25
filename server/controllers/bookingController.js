import crypto from "crypto";
import Booking from "../models/Booking.js";
import ParkingSlot from "../models/ParkingSlot.js";
import ParkingSpot from "../models/ParkingSpot.js";
import mongoose from "mongoose";
import {
  getParkingAvailability,
  normalizeSpotPreference,
} from "../utils/parkingSpotHelpers.js";
import {
  computeBookingExpiryTime,
  runBookingLifecycleMaintenance,
} from "../utils/bookingLifecycle.js";
import {
  emitAvailabilityChanged,
  emitBookingChanged,
} from "../utils/realtime.js";

export const bookingControllerDependencies = {
  computeBookingExpiryTime,
  getParkingAvailability,
  runBookingLifecycleMaintenance,
};

const BOOKING_SPOT_LOCK_MS = 15 * 1000;
const BOOKING_LOCK_RETRY_COUNT = 3;
const BOOKING_LOCK_RETRY_DELAY_MS = 80;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSpotLockAvailabilityQuery = (parkingSpotId, lockToken, now) => ({
  _id: parkingSpotId,
  isActive: true,
  $or: [
    { "reservationLock.token": lockToken },
    { "reservationLock.token": { $exists: false } },
    { "reservationLock.token": "" },
    { "reservationLock.token": null },
    { "reservationLock.expiresAt": { $exists: false } },
    { "reservationLock.expiresAt": null },
    { "reservationLock.expiresAt": { $lte: now } },
  ],
});

const acquireParkingSpotLock = async (
  parkingSpotId,
  lockToken,
  now = new Date()
) =>
  ParkingSpot.findOneAndUpdate(
    buildSpotLockAvailabilityQuery(parkingSpotId, lockToken, now),
    {
      $set: {
        "reservationLock.token": lockToken,
        "reservationLock.expiresAt": new Date(
          now.getTime() + BOOKING_SPOT_LOCK_MS
        ),
      },
    },
    {
      new: true,
    }
  ).select("_id");

const releaseParkingSpotLock = async (parkingSpotId, lockToken) => {
  if (!parkingSpotId || !lockToken) {
    return;
  }

  await ParkingSpot.findOneAndUpdate(
    {
      _id: parkingSpotId,
      "reservationLock.token": lockToken,
    },
    {
      $set: {
        "reservationLock.token": "",
        "reservationLock.expiresAt": null,
      },
    }
  );
};

const buildNoSpotMessage = (spotPreference) =>
  spotPreference === "nearest"
    ? "All slots are booked for this time range"
    : `No ${spotPreference} spots are available for this time range`;

const getCandidateParkingSpots = (
  preferredAvailableSpots,
  firstAvailableSpot
) =>
  Array.isArray(preferredAvailableSpots) && preferredAvailableSpots.length > 0
    ? preferredAvailableSpots
    : firstAvailableSpot
      ? [firstAvailableSpot]
      : [];

const createLockedBooking = async ({
  candidateSpots,
  end,
  expiresAt,
  normalizedParkingSlotId,
  normalizedSpotPreference,
  start,
  totalPrice,
  userId,
}) => {
  let hadContention = false;

  for (const candidateSpot of candidateSpots) {
    const lockToken = crypto.randomUUID();
    const lockedSpot = await acquireParkingSpotLock(candidateSpot._id, lockToken);

    if (!lockedSpot) {
      hadContention = true;
      continue;
    }

    try {
      const overlappingBooking = await Booking.findOne({
        parkingSpot: lockedSpot._id,
        status: "booked",
        startTime: { $lt: end },
        endTime: { $gt: start },
      }).select("_id");

      if (overlappingBooking) {
        hadContention = true;
        continue;
      }

      const booking = await Booking.create({
        user: userId,
        parkingSlot: normalizedParkingSlotId,
        parkingSpot: lockedSpot._id,
        startTime: start,
        endTime: end,
        spotPreference: normalizedSpotPreference,
        totalPrice,
        expiresAt,
      });

      return { booking, hadContention };
    } finally {
      await releaseParkingSpotLock(lockedSpot._id, lockToken);
    }
  }

  return {
    booking: null,
    hadContention,
  };
};

const populateBooking = (query) =>
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

export const createBooking = async (req, res, next) => {
  try {
    const { parkingSlotId, startTime, endTime, spotPreference } = req.body;
    await bookingControllerDependencies.runBookingLifecycleMaintenance({
      silent: true,
    });

    const normalizedParkingSlotId =
      typeof parkingSlotId === "string" ? parkingSlotId.trim() : parkingSlotId;

    if (!normalizedParkingSlotId || !startTime || !endTime) {
      return res.status(400).json({
        message: "parkingSlotId, startTime, and endTime are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(normalizedParkingSlotId)) {
      return res.status(400).json({
        message: "Invalid parkingSlotId",
      });
    }

    const parking = await ParkingSlot.findById(normalizedParkingSlotId);

    if (!parking) {
      return res.status(404).json({ message: "Parking slot not found" });
    }

    if (parking.status !== "active") {
      return res.status(400).json({
        message: "This parking slot is currently unavailable",
      });
    }

    if (parking.availableSlots <= 0) {
      return res.status(400).json({
        message: "No parking slots are currently available",
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        message: "startTime and endTime must be valid ISO date strings",
      });
    }

    if (start >= end) {
      return res.status(400).json({
        message: "Invalid time range",
      });
    }

    const normalizedSpotPreference = normalizeSpotPreference(spotPreference);

    if (!normalizedSpotPreference) {
      return res.status(400).json({
        message:
          "spotPreference must be nearest, standard, vip, or accessible",
      });
    }

    const durationMs = end - start;
    const durationInHours = durationMs / (1000 * 60 * 60);

    if (durationInHours <= 0) {
      return res.status(400).json({
        message: "Invalid time range",
      });
    }

    const totalPrice = Math.ceil(durationInHours * parking.pricePerHour);
    const expiresAt = bookingControllerDependencies.computeBookingExpiryTime(
      start,
      end
    );
    let booking = null;
    let didHitContention = false;

    for (let attempt = 0; attempt < BOOKING_LOCK_RETRY_COUNT; attempt += 1) {
      const {
        activeParkingSpots,
        firstAvailableSpot,
        preferredAvailableSpots,
      } = await bookingControllerDependencies.getParkingAvailability(
        parking,
        start,
        end,
        normalizedSpotPreference
      );

      if (activeParkingSpots.length === 0) {
        return res.status(400).json({
          message: "No parking slots are currently available",
        });
      }

      const candidateSpots = getCandidateParkingSpots(
        preferredAvailableSpots,
        firstAvailableSpot
      );

      if (candidateSpots.length === 0) {
        return res.status(400).json({
          message: buildNoSpotMessage(normalizedSpotPreference),
        });
      }

      const bookingAttempt = await createLockedBooking({
        candidateSpots,
        end,
        expiresAt,
        normalizedParkingSlotId,
        normalizedSpotPreference,
        start,
        totalPrice,
        userId: req.user.id,
      });

      if (bookingAttempt.booking) {
        booking = bookingAttempt.booking;
        break;
      }

      didHitContention = didHitContention || bookingAttempt.hadContention;

      if (attempt < BOOKING_LOCK_RETRY_COUNT - 1) {
        await delay(BOOKING_LOCK_RETRY_DELAY_MS);
      }
    }

    if (!booking) {
      return res.status(didHitContention ? 409 : 400).json({
        message: didHitContention
          ? "Parking availability changed while we were confirming your booking. Please try again."
          : buildNoSpotMessage(normalizedSpotPreference),
      });
    }

    const populatedBooking = await populateBooking(Booking.findById(booking._id));

    emitBookingChanged({
      bookingId: booking._id,
      parkingSlotId: normalizedParkingSlotId,
      reason: "created",
    });
    emitAvailabilityChanged({
      parkingSlotId: normalizedParkingSlotId,
      reason: "created",
    });

    return res.status(201).json({
      message: "Booking created successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    await bookingControllerDependencies.runBookingLifecycleMaintenance({
      silent: true,
    });
    const bookingId = req.params.id?.trim();

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: "Invalid bookingId" });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking already cancelled" });
    }

    if (booking.status !== "booked") {
      return res.status(400).json({
        message: "Only active bookings can be cancelled",
      });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancellationReason = "user_cancelled";
    await booking.save();

    const populatedBooking = await populateBooking(Booking.findById(booking._id));

    emitBookingChanged({
      bookingId: booking._id,
      parkingSlotId: booking.parkingSlot,
      reason: "cancelled",
    });
    emitAvailabilityChanged({
      parkingSlotId: booking.parkingSlot,
      reason: "cancelled",
    });

    return res.status(200).json({
      message: "Booking cancelled successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    await bookingControllerDependencies.runBookingLifecycleMaintenance({
      silent: true,
    });
    const bookings = await Booking.find({ user: req.user.id })
      .populate(
        "parkingSlot",
        "title imageUrl status location pricePerHour availableSlots allocationConfig owner"
      )
      .populate(
        "parkingSpot",
        "spotNumber label spotType distanceFromEntrance isActive"
      )
      .populate("validatedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json(bookings);
  } catch (error) {
    return next(error);
  }
};

export const updateBookingStatuses = async (options) =>
  bookingControllerDependencies.runBookingLifecycleMaintenance(options);
