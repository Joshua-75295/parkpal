import Booking from "../models/Booking.js";
import ParkingSpot from "../models/ParkingSpot.js";

const timeRangesOverlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

export const DEFAULT_SPOT_PREFERENCE = "nearest";

const SPOT_PREFERENCES = new Set([
  DEFAULT_SPOT_PREFERENCE,
  "standard",
  "vip",
  "accessible",
]);

const createEmptySpotMix = () => ({
  standard: 0,
  vip: 0,
  accessible: 0,
});

const toNonNegativeInteger = (value) => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return parsedValue;
};

export const normalizeSpotPreference = (spotPreference) => {
  if (spotPreference == null || spotPreference === "") {
    return DEFAULT_SPOT_PREFERENCE;
  }

  const normalizedPreference =
    typeof spotPreference === "string" ? spotPreference.trim() : spotPreference;

  if (!SPOT_PREFERENCES.has(normalizedPreference)) {
    return null;
  }

  return normalizedPreference;
};

export const normalizeAllocationConfig = (allocationConfig = {}) => ({
  accessibleSpotCount: toNonNegativeInteger(allocationConfig?.accessibleSpotCount),
  vipSpotCount: toNonNegativeInteger(allocationConfig?.vipSpotCount),
});

const getSpotType = (spotNumber, allocationConfig) => {
  const { accessibleSpotCount, vipSpotCount } =
    normalizeAllocationConfig(allocationConfig);

  if (spotNumber <= accessibleSpotCount) {
    return "accessible";
  }

  if (spotNumber <= accessibleSpotCount + vipSpotCount) {
    return "vip";
  }

  return "standard";
};

const getSpotLabel = (spotNumber, spotType) => {
  if (spotType === "accessible") {
    return `Accessible Spot ${spotNumber}`;
  }

  if (spotType === "vip") {
    return `VIP Spot ${spotNumber}`;
  }

  return `Spot ${spotNumber}`;
};

const sortParkingSpotsByDistance = (parkingSpots) =>
  [...parkingSpots].sort(
    (leftSpot, rightSpot) =>
      (leftSpot.distanceFromEntrance ?? leftSpot.spotNumber) -
        (rightSpot.distanceFromEntrance ?? rightSpot.spotNumber) ||
      leftSpot.spotNumber - rightSpot.spotNumber
  );

export const buildParkingSpots = (
  parkingSlotId,
  spotCount,
  allocationConfig = {}
) =>
  Array.from({ length: spotCount }, (_, index) => {
    const spotNumber = index + 1;
    const spotType = getSpotType(spotNumber, allocationConfig);

    return {
      parkingSlot: parkingSlotId,
      spotNumber,
      label: getSpotLabel(spotNumber, spotType),
      spotType,
      distanceFromEntrance: spotNumber,
      isActive: true,
    };
  });

export const getSpotMix = (parkingSpots = []) =>
  parkingSpots.reduce((spotMix, spot) => {
    const spotType = spot?.spotType ?? "standard";

    if (spotMix[spotType] == null) {
      spotMix[spotType] = 0;
    }

    spotMix[spotType] += 1;
    return spotMix;
  }, createEmptySpotMix());

const getPreferredAvailableSpots = (availableSpots, spotPreference) => {
  const normalizedSpotPreference = normalizeSpotPreference(spotPreference);
  const sortedAvailableSpots = sortParkingSpotsByDistance(availableSpots);

  if (
    normalizedSpotPreference === DEFAULT_SPOT_PREFERENCE ||
    normalizedSpotPreference == null
  ) {
    return sortedAvailableSpots;
  }

  return sortedAvailableSpots.filter(
    (spot) => spot.spotType === normalizedSpotPreference
  );
};

export const ensureParkingSpots = async (parking) => {
  const configuredSpotCount = Number(parking.availableSlots) || 0;
  const desiredSpots = buildParkingSpots(
    parking._id,
    configuredSpotCount,
    parking.allocationConfig
  );

  if (configuredSpotCount <= 0) {
    await ParkingSpot.updateMany(
      { parkingSlot: parking._id, isActive: true },
      { $set: { isActive: false } }
    );

    return [];
  }

  const existingSpots = await ParkingSpot.find({ parkingSlot: parking._id })
    .select(
      "_id parkingSlot spotNumber label spotType distanceFromEntrance isActive"
    )
    .sort({ spotNumber: 1 });

  const existingSpotsByNumber = new Map(
    existingSpots.map((spot) => [spot.spotNumber, spot])
  );
  const missingSpots = [];
  const spotUpdates = [];

  for (const desiredSpot of desiredSpots) {
    const existingSpot = existingSpotsByNumber.get(desiredSpot.spotNumber);

    if (!existingSpot) {
      missingSpots.push(desiredSpot);
      continue;
    }

    if (
      existingSpot.label !== desiredSpot.label ||
      existingSpot.spotType !== desiredSpot.spotType ||
      existingSpot.distanceFromEntrance !== desiredSpot.distanceFromEntrance ||
      !existingSpot.isActive
    ) {
      spotUpdates.push({
        updateOne: {
          filter: { _id: existingSpot._id },
          update: {
            $set: {
              label: desiredSpot.label,
              spotType: desiredSpot.spotType,
              distanceFromEntrance: desiredSpot.distanceFromEntrance,
              isActive: true,
            },
          },
        },
      });
    }
  }

  if (missingSpots.length > 0) {
    try {
      await ParkingSpot.insertMany(missingSpots, { ordered: false });
    } catch (error) {
      const duplicateOnly =
        error?.code === 11000 ||
        error?.writeErrors?.every((writeError) => writeError.code === 11000);

      if (!duplicateOnly) {
        throw error;
      }
    }
  }

  const extraSpots = existingSpots.filter(
    (spot) => spot.spotNumber > configuredSpotCount && spot.isActive
  );

  if (extraSpots.length > 0) {
    spotUpdates.push(
      ...extraSpots.map((spot) => ({
        updateOne: {
          filter: { _id: spot._id },
          update: {
            $set: {
              isActive: false,
            },
          },
        },
      }))
    );
  }

  if (spotUpdates.length > 0) {
    await ParkingSpot.bulkWrite(spotUpdates, { ordered: false });
  }

  const parkingSpots = await ParkingSpot.find({ parkingSlot: parking._id })
    .select(
      "_id parkingSlot spotNumber label spotType distanceFromEntrance isActive"
    )
    .sort({ spotNumber: 1 });

  return parkingSpots.filter((spot) => spot.spotNumber <= configuredSpotCount);
};

export const ensureBookedParkingSpotAssignments = async (parking) => {
  const parkingSpots = await ensureParkingSpots(parking);

  if (parkingSpots.length === 0) {
    return [];
  }

  const bookedBookings = await Booking.find({
    parkingSlot: parking._id,
    status: "booked",
  })
    .select("_id parkingSpot spotPreference startTime endTime")
    .sort({ startTime: 1, createdAt: 1, _id: 1 });

  const spotSchedules = new Map(
    parkingSpots.map((spot) => [spot._id.toString(), []])
  );

  for (const booking of bookedBookings) {
    if (!booking.parkingSpot) {
      continue;
    }

    const schedule = spotSchedules.get(booking.parkingSpot.toString());

    if (!schedule) {
      throw new Error(
        "Active bookings reference parking spots outside the configured inventory"
      );
    }

    schedule.push({
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  }

  for (const booking of bookedBookings) {
    if (booking.parkingSpot) {
      continue;
    }

    const freeSpots = parkingSpots.filter((spot) => {
      if (!spot.isActive) {
        return false;
      }

      const schedule = spotSchedules.get(spot._id.toString()) || [];

      return schedule.every(
        (reservation) =>
          !timeRangesOverlap(
            booking.startTime,
            booking.endTime,
            reservation.startTime,
            reservation.endTime
          )
      );
    });
    const availableSpot = getPreferredAvailableSpots(
      freeSpots,
      booking.spotPreference
    )[0];

    if (!availableSpot) {
      throw new Error(
        "Existing bookings exceed the number of physical parking spots"
      );
    }

    await Booking.findByIdAndUpdate(booking._id, {
      parkingSpot: availableSpot._id,
    });

    const schedule = spotSchedules.get(availableSpot._id.toString());
    schedule.push({
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  }

  return parkingSpots;
};

export const getParkingAvailability = async (
  parking,
  startTime,
  endTime,
  requestedSpotPreference = DEFAULT_SPOT_PREFERENCE
) => {
  const parkingSpots = await ensureBookedParkingSpotAssignments(parking);
  const activeParkingSpots = sortParkingSpotsByDistance(
    parkingSpots.filter((spot) => spot.isActive)
  );

  if (activeParkingSpots.length === 0) {
    return {
      activeParkingSpots,
      availableSpots: [],
      availableSpotCount: 0,
      availableSpotMix: createEmptySpotMix(),
      preferredAvailableSpots: [],
      preferredAvailableSpotCount: 0,
      firstAvailableSpot: null,
    };
  }

  const overlappingBookings = await Booking.find({
    parkingSlot: parking._id,
    status: "booked",
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  }).select("parkingSpot");

  const reservedSpotIds = new Set(
    overlappingBookings
      .map((booking) => booking.parkingSpot?.toString())
      .filter(Boolean)
  );
  const availableSpots = activeParkingSpots.filter(
    (spot) => !reservedSpotIds.has(spot._id.toString())
  );
  const preferredAvailableSpots = getPreferredAvailableSpots(
    availableSpots,
    requestedSpotPreference
  );

  return {
    activeParkingSpots,
    availableSpots,
    availableSpotCount: availableSpots.length,
    availableSpotMix: getSpotMix(availableSpots),
    preferredAvailableSpots,
    preferredAvailableSpotCount: preferredAvailableSpots.length,
    firstAvailableSpot: preferredAvailableSpots[0] || null,
  };
};
