import Booking from "../models/Booking.js";
import mongoose from "mongoose";
import ParkingSlot from "../models/ParkingSlot.js";
import ParkingSpot from "../models/ParkingSpot.js";
import User from "../models/User.js";
import {
  ensureParkingSpots,
  getParkingAvailability,
  normalizeAllocationConfig,
} from "../utils/parkingSpotHelpers.js";
import { runBookingLifecycleMaintenance } from "../utils/bookingLifecycle.js";
import {
  deleteManagedParkingImage,
  saveParkingImageFromDataUri,
} from "../utils/parkingImageStorage.js";
import { emitInventoryChanged } from "../utils/realtime.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeLocation = (location) => {
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    return location;
  }

  return {
    address:
      typeof location.address === "string"
        ? location.address.trim()
        : location.address,
    lat: location.lat === undefined ? undefined : Number(location.lat),
    lng: location.lng === undefined ? undefined : Number(location.lng),
  };
};

const normalizeAllocationPayload = (allocationConfig) => {
  if (allocationConfig === undefined) {
    return undefined;
  }

  if (
    !allocationConfig ||
    typeof allocationConfig !== "object" ||
    Array.isArray(allocationConfig)
  ) {
    return allocationConfig;
  }

  return {
    accessibleSpotCount:
      allocationConfig.accessibleSpotCount === undefined
        ? undefined
        : Number(allocationConfig.accessibleSpotCount),
    vipSpotCount:
      allocationConfig.vipSpotCount === undefined
        ? undefined
        : Number(allocationConfig.vipSpotCount),
  };
};

const parseParkingPayload = (body) => ({
  title: typeof body.title === "string" ? body.title.trim() : body.title,
  imageData:
    typeof body.imageData === "string" ? body.imageData.trim() : body.imageData,
  imageUrl:
    typeof body.imageUrl === "string" ? body.imageUrl.trim() : body.imageUrl,
  location: normalizeLocation(body.location),
  pricePerHour:
    body.pricePerHour === undefined ? undefined : Number(body.pricePerHour),
  availableSlots:
    body.availableSlots === undefined ? undefined : Number(body.availableSlots),
  allocationConfig: normalizeAllocationPayload(body.allocationConfig),
  status: typeof body.status === "string" ? body.status.trim() : body.status,
});

const validatePricePerHour = (pricePerHour) => {
  if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) {
    return "pricePerHour must be a positive number";
  }

  return null;
};

const validateAvailableSlots = (availableSlots) => {
  if (!Number.isInteger(availableSlots) || availableSlots < 0) {
    return "availableSlots must be a whole number greater than or equal to 0";
  }

  return null;
};

const resolveAllocationConfig = (currentConfig, nextConfig) => {
  const normalizedCurrentConfig = normalizeAllocationConfig(currentConfig);

  if (nextConfig === undefined) {
    return normalizedCurrentConfig;
  }

  if (!nextConfig || typeof nextConfig !== "object" || Array.isArray(nextConfig)) {
    return nextConfig;
  }

  return {
    accessibleSpotCount:
      nextConfig.accessibleSpotCount === undefined
        ? normalizedCurrentConfig.accessibleSpotCount
        : nextConfig.accessibleSpotCount,
    vipSpotCount:
      nextConfig.vipSpotCount === undefined
        ? normalizedCurrentConfig.vipSpotCount
        : nextConfig.vipSpotCount,
  };
};

const validateAllocationConfig = (allocationConfig, availableSlots) => {
  if (
    !allocationConfig ||
    typeof allocationConfig !== "object" ||
    Array.isArray(allocationConfig)
  ) {
    return "allocationConfig must be an object";
  }

  const { accessibleSpotCount, vipSpotCount } =
    normalizeAllocationConfig(allocationConfig);

  if (
    !Number.isInteger(allocationConfig.accessibleSpotCount) ||
    allocationConfig.accessibleSpotCount < 0
  ) {
    return "allocationConfig.accessibleSpotCount must be a whole number greater than or equal to 0";
  }

  if (
    !Number.isInteger(allocationConfig.vipSpotCount) ||
    allocationConfig.vipSpotCount < 0
  ) {
    return "allocationConfig.vipSpotCount must be a whole number greater than or equal to 0";
  }

  if (accessibleSpotCount + vipSpotCount > availableSlots) {
    return "accessible and VIP spot counts cannot exceed availableSlots";
  }

  return null;
};

const validateSlotStatus = (status) => {
  if (!["active", "maintenance", "inactive"].includes(status)) {
    return "status must be active, maintenance, or inactive";
  }

  return null;
};

const canManageParking = (parking, user) =>
  user?.role === "super_admin" || parking.owner?.toString() === user?.id;

const getFavoriteParkingSlotIds = (user) =>
  (user?.favoriteParkingSlots ?? []).map((parkingSlotId) =>
    parkingSlotId.toString()
  );

const validateLocation = (location) => {
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    return "location must be an object with address, lat, and lng";
  }

  if (!location.address || location.lat == null || location.lng == null) {
    return "location.address, location.lat, and location.lng are required";
  }

  if (!Number.isFinite(location.lat) || location.lat < -90 || location.lat > 90) {
    return "location.lat must be a valid latitude between -90 and 90";
  }

  if (!Number.isFinite(location.lng) || location.lng < -180 || location.lng > 180) {
    return "location.lng must be a valid longitude between -180 and 180";
  }

  return null;
};

const ensureRemovedSpotsAreUnused = async (parkingId, configuredSpotCount) => {
  const removedSpots = await ParkingSpot.find({
    parkingSlot: parkingId,
    spotNumber: { $gt: configuredSpotCount },
  }).select("_id");

  if (removedSpots.length === 0) {
    return { ok: true };
  }

  const activeBookingsOnRemovedSpots = await Booking.countDocuments({
    parkingSpot: { $in: removedSpots.map((spot) => spot._id) },
    status: "booked",
  });

  if (activeBookingsOnRemovedSpots > 0) {
    return {
      ok: false,
      message:
        "Cannot reduce availableSlots while active bookings still use those parking spots",
    };
  }

  return { ok: true };
};

export const getMyFavoriteParkingSlotIds = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("favoriteParkingSlots");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      favoriteParkingSlotIds: getFavoriteParkingSlotIds(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const addFavoriteParkingSlot = async (req, res, next) => {
  try {
    const parkingId = req.params.id?.trim();

    if (!parkingId || !mongoose.Types.ObjectId.isValid(parkingId)) {
      return res.status(400).json({ message: "Invalid parkingSlotId" });
    }

    const parking = await ParkingSlot.findById(parkingId).select("_id");

    if (!parking) {
      return res.status(404).json({ message: "Parking slot not found" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $addToSet: {
          favoriteParkingSlots: parkingId,
        },
      },
      {
        new: true,
      }
    ).select("favoriteParkingSlots");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Parking slot saved to favorites",
      favoriteParkingSlotIds: getFavoriteParkingSlotIds(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const removeFavoriteParkingSlot = async (req, res, next) => {
  try {
    const parkingId = req.params.id?.trim();

    if (!parkingId || !mongoose.Types.ObjectId.isValid(parkingId)) {
      return res.status(400).json({ message: "Invalid parkingSlotId" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: {
          favoriteParkingSlots: parkingId,
        },
      },
      {
        new: true,
      }
    ).select("favoriteParkingSlots");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Parking slot removed from favorites",
      favoriteParkingSlotIds: getFavoriteParkingSlotIds(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const createParkingSlot = async (req, res, next) => {
  try {
    const looksLikeBookingPayload =
      req.body?.parkingSlotId || req.body?.startTime || req.body?.endTime;
    const {
      title,
      imageData,
      imageUrl,
      location,
      pricePerHour,
      availableSlots,
      allocationConfig,
      status,
    } = parseParkingPayload(req.body);

    if (!title || !location || pricePerHour == null || availableSlots == null) {
      if (looksLikeBookingPayload) {
        return res.status(400).json({
          message:
            "This body looks like a booking request. Use POST /api/bookings for parkingSlotId, startTime, and endTime.",
        });
      }

      return res.status(400).json({
        message:
          "Title, location, pricePerHour, and availableSlots are required",
      });
    }

    const priceError = validatePricePerHour(pricePerHour);

    if (priceError) {
      return res.status(400).json({ message: priceError });
    }

    const locationError = validateLocation(location);

    if (locationError) {
      return res.status(400).json({ message: locationError });
    }

    const slotCountError = validateAvailableSlots(availableSlots);

    if (slotCountError) {
      return res.status(400).json({ message: slotCountError });
    }

    const resolvedAllocationConfig = resolveAllocationConfig(
      undefined,
      allocationConfig
    );
    const allocationError = validateAllocationConfig(
      resolvedAllocationConfig,
      availableSlots
    );

    if (allocationError) {
      return res.status(400).json({ message: allocationError });
    }

    const statusValue = status || "active";
    const statusError = validateSlotStatus(statusValue);

    if (statusError) {
      return res.status(400).json({ message: statusError });
    }

    const uploadedImageUrl = imageData
      ? await saveParkingImageFromDataUri(imageData)
      : "";
    let parking = null;

    try {
      parking = await ParkingSlot.create({
        title,
        imageUrl: uploadedImageUrl || imageUrl || "",
        location,
        pricePerHour,
        availableSlots,
        allocationConfig: normalizeAllocationConfig(resolvedAllocationConfig),
        status: statusValue,
        owner: req.user.id,
      });

      await ensureParkingSpots(parking);

      emitInventoryChanged({
        parkingSlotId: parking._id,
        reason: "created",
      });

      return res.status(201).json(parking);
    } catch (error) {
      await deleteManagedParkingImage(uploadedImageUrl);
      if (parking?._id) {
        await ParkingSpot.deleteMany({ parkingSlot: parking._id });
        await ParkingSlot.findByIdAndDelete(parking._id);
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
};

export const createParking = createParkingSlot;

export const updateParkingSlot = async (req, res, next) => {
  try {
    const parkingId = req.params.id?.trim();

    if (!parkingId || !mongoose.Types.ObjectId.isValid(parkingId)) {
      return res.status(400).json({ message: "Invalid parkingSlotId" });
    }

    const parking = await ParkingSlot.findById(parkingId);

    if (!parking) {
      return res.status(404).json({ message: "Parking slot not found" });
    }

    if (!canManageParking(parking, req.user)) {
      return res.status(403).json({
        message: "You can only manage parking slots you own",
      });
    }

    const parsedPayload = parseParkingPayload(req.body);
    const updates = {};
    let replacedImageUrl = "";
    let uploadedImageUrl = "";

    if (parsedPayload.title !== undefined) {
      if (!parsedPayload.title) {
        return res.status(400).json({ message: "title cannot be empty" });
      }

      updates.title = parsedPayload.title;
    }

    if (parsedPayload.location !== undefined) {
      const locationError = validateLocation(parsedPayload.location);

      if (locationError) {
        return res.status(400).json({ message: locationError });
      }

      updates.location = parsedPayload.location;
    }

    if (parsedPayload.imageUrl !== undefined) {
      updates.imageUrl = parsedPayload.imageUrl || "";
      if (parking.imageUrl && parking.imageUrl !== updates.imageUrl) {
        replacedImageUrl = parking.imageUrl;
      }
    }

    if (parsedPayload.imageData) {
      uploadedImageUrl = await saveParkingImageFromDataUri(parsedPayload.imageData);
      updates.imageUrl = uploadedImageUrl;
      if (parking.imageUrl && parking.imageUrl !== uploadedImageUrl) {
        replacedImageUrl = parking.imageUrl;
      }
    }

    if (parsedPayload.pricePerHour !== undefined) {
      const priceError = validatePricePerHour(parsedPayload.pricePerHour);

      if (priceError) {
        return res.status(400).json({ message: priceError });
      }

      updates.pricePerHour = parsedPayload.pricePerHour;
    }

    if (parsedPayload.availableSlots !== undefined) {
      const slotCountError = validateAvailableSlots(parsedPayload.availableSlots);

      if (slotCountError) {
        return res.status(400).json({ message: slotCountError });
      }
    }

    const nextAvailableSlots =
      parsedPayload.availableSlots ?? parking.availableSlots;
    const nextAllocationConfig = resolveAllocationConfig(
      parking.allocationConfig,
      parsedPayload.allocationConfig
    );

    if (
      parsedPayload.availableSlots !== undefined ||
      parsedPayload.allocationConfig !== undefined
    ) {
      const allocationError = validateAllocationConfig(
        nextAllocationConfig,
        nextAvailableSlots
      );

      if (allocationError) {
        return res.status(400).json({ message: allocationError });
      }

      if (parsedPayload.availableSlots !== undefined) {
        const syncResult = await ensureRemovedSpotsAreUnused(
          parking._id,
          parsedPayload.availableSlots
        );

        if (!syncResult.ok) {
          return res.status(400).json({ message: syncResult.message });
        }

        updates.availableSlots = parsedPayload.availableSlots;
      }

      updates.allocationConfig = normalizeAllocationConfig(nextAllocationConfig);
    }

    if (parsedPayload.status !== undefined) {
      const statusError = validateSlotStatus(parsedPayload.status);

      if (statusError) {
        return res.status(400).json({ message: statusError });
      }

      updates.status = parsedPayload.status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    let updatedParking;

    try {
      updatedParking = await ParkingSlot.findByIdAndUpdate(
        parkingId,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate("owner", "name email");

      await ensureParkingSpots(updatedParking);
    } catch (error) {
      await deleteManagedParkingImage(uploadedImageUrl);
      throw error;
    }

    if (replacedImageUrl) {
      await deleteManagedParkingImage(replacedImageUrl);
    }

    emitInventoryChanged({
      parkingSlotId: updatedParking._id,
      reason: "updated",
    });

    return res.status(200).json({
      message: "Parking slot updated successfully",
      parking: updatedParking,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteParkingSlot = async (req, res, next) => {
  try {
    const parkingId = req.params.id?.trim();

    if (!parkingId || !mongoose.Types.ObjectId.isValid(parkingId)) {
      return res.status(400).json({ message: "Invalid parkingSlotId" });
    }

    const parking = await ParkingSlot.findById(parkingId);

    if (!parking) {
      return res.status(404).json({ message: "Parking slot not found" });
    }

    if (!canManageParking(parking, req.user)) {
      return res.status(403).json({
        message: "You can only remove parking slots you own",
      });
    }

    const activeBookings = await Booking.countDocuments({
      parkingSlot: parkingId,
      status: "booked",
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        message: "Cannot delete parking slot with active bookings",
      });
    }

    await ParkingSpot.deleteMany({ parkingSlot: parkingId });
    await ParkingSlot.findByIdAndDelete(parkingId);
    await deleteManagedParkingImage(parking.imageUrl);

    emitInventoryChanged({
      parkingSlotId: parkingId,
      reason: "deleted",
    });

    return res.status(200).json({
      message: "Parking slot deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllParking = async (req, res, next) => {
  try {
    const { location, minPrice, maxPrice } = req.query;
    const filters = {
      status: "active",
    };

    if (location?.trim()) {
      filters.$or = [
        {
          "location.address": {
            $regex: escapeRegex(location.trim()),
            $options: "i",
          },
        },
        {
          location: {
            $regex: escapeRegex(location.trim()),
            $options: "i",
          },
        },
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filters.pricePerHour = {};

      if (minPrice !== undefined && minPrice !== "") {
        const parsedMinPrice = Number(minPrice);

        if (Number.isNaN(parsedMinPrice)) {
          return res
            .status(400)
            .json({ message: "minPrice must be a valid number" });
        }

        filters.pricePerHour.$gte = parsedMinPrice;
      }

      if (maxPrice !== undefined && maxPrice !== "") {
        const parsedMaxPrice = Number(maxPrice);

        if (Number.isNaN(parsedMaxPrice)) {
          return res
            .status(400)
            .json({ message: "maxPrice must be a valid number" });
        }

        filters.pricePerHour.$lte = parsedMaxPrice;
      }

      if (
        filters.pricePerHour.$gte !== undefined &&
        filters.pricePerHour.$lte !== undefined &&
        filters.pricePerHour.$gte > filters.pricePerHour.$lte
      ) {
        return res.status(400).json({
          message: "minPrice cannot be greater than maxPrice",
        });
      }

      if (Object.keys(filters.pricePerHour).length === 0) {
        delete filters.pricePerHour;
      }
    }

    const parking = await ParkingSlot.find(filters).populate("owner", "name email");
    return res.json(parking);
  } catch (error) {
    return next(error);
  }
};

export const getAvailableSlots = async (req, res, next) => {
  try {
    await runBookingLifecycleMaintenance({ silent: true });
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        message: "startTime and endTime are required",
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

    const slots = await ParkingSlot.find({ status: "active" }).populate("owner", "name email");
    const availableSlots = [];

    for (const slot of slots) {
      const { activeParkingSpots, availableSpotCount, availableSpotMix } =
        await getParkingAvailability(slot, start, end);

      if (availableSpotCount > 0) {
        availableSlots.push({
          ...slot.toObject(),
          totalActiveSpots: activeParkingSpots.length,
          availableSpotCount,
          availableSpotMix,
        });
      }
    }

    return res.status(200).json(availableSlots);
  } catch (error) {
    return next(error);
  }
};

export const getMyParking = async (req, res, next) => {
  try {
    const filters =
      req.user.role === "super_admin" ? {} : { owner: req.user.id };
    const parking = await ParkingSlot.find(filters)
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    return res.json(parking);
  } catch (error) {
    return next(error);
  }
};
