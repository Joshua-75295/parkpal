import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import {
  resolveParkingUploadDirectory,
  resolveUploadsDirectory,
} from "../config/storage.js";
import {
  adminControllerDependencies,
  validateManagedBooking,
} from "../controllers/adminController.js";
import { loginUser } from "../controllers/authController.js";
import {
  bookingControllerDependencies,
  createBooking,
} from "../controllers/bookingController.js";
import Booking from "../models/Booking.js";
import ParkingSlot from "../models/ParkingSlot.js";
import ParkingSpot from "../models/ParkingSpot.js";
import User from "../models/User.js";
import {
  createMockResponse,
  createNextCollector,
} from "./helpers/mockHttp.js";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

const listenToApp = async (app) => {
  const server = createServer(app);

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
};

test("loginUser issues a cookie-based session for valid credentials", async () => {
  const originalFindOne = User.findOne;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const password = "Pass@123";
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = new mongoose.Types.ObjectId();

  User.findOne = async () => ({
    _id: userId,
    email: "user@parkpal.com",
    name: "Test User",
    password: hashedPassword,
    role: "user",
  });
  User.findByIdAndUpdate = async () => null;

  try {
    const req = {
      body: {
        email: "user@parkpal.com",
        password,
      },
      headers: {},
    };
    const res = createMockResponse();
    const next = createNextCollector();

    await loginUser(req, res, next);

    assert.equal(next.error(), null);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.email, "user@parkpal.com");
    assert.equal(res.body.session.strategy, "httpOnly-cookies");
    assert.deepEqual(
      res.cookies.map((cookie) => cookie.name).sort(),
      ["parkpal_access", "parkpal_refresh"]
    );
  } finally {
    User.findOne = originalFindOne;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("health endpoint reports degraded status and blocks API routes while the database is unavailable", async () => {
  const app = createApp(undefined, {
    getDatabaseHealth: () => ({
      attemptCount: 2,
      isReady: false,
      lastError: "Connection timeout",
      readyState: 0,
      status: "connecting",
    }),
    getUploadsDirectory: () => resolveUploadsDirectory("test-uploads"),
    isDatabaseReady: () => false,
  });
  const { baseUrl, server } = await listenToApp(app);

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthPayload = await healthResponse.json();
    const parkingResponse = await fetch(`${baseUrl}/api/parking`);
    const parkingPayload = await parkingResponse.json();

    assert.equal(healthResponse.status, 503);
    assert.equal(healthPayload.service.status, "degraded");
    assert.equal(healthPayload.database.lastError, "Connection timeout");
    assert.equal(parkingResponse.status, 503);
    assert.equal(parkingPayload.code, "DATABASE_UNAVAILABLE");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("health endpoint reports ok once the database is ready", async () => {
  const app = createApp(undefined, {
    getDatabaseHealth: () => ({
      attemptCount: 1,
      connectedAt: "2026-04-03T09:00:00.000Z",
      host: "cluster.mongodb.net",
      isReady: true,
      readyState: 1,
      status: "ready",
    }),
    getUploadsDirectory: () => resolveUploadsDirectory("test-uploads"),
    isDatabaseReady: () => true,
  });
  const { baseUrl, server } = await listenToApp(app);

  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.service.status, "ok");
    assert.equal(payload.database.host, "cluster.mongodb.net");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("storage config resolves parking uploads inside the configured uploads root", () => {
  const uploadsDirectory = resolveUploadsDirectory("custom-uploads");

  assert.equal(
    resolveParkingUploadDirectory("custom-uploads"),
    path.join(uploadsDirectory, "parking")
  );
  assert.equal(
    resolveParkingUploadDirectory(""),
    path.join(resolveUploadsDirectory(""), "parking")
  );
});

test("createBooking rejects a request when all matching spots are unavailable", async () => {
  const originalFindById = ParkingSlot.findById;
  const originalGetParkingAvailability =
    bookingControllerDependencies.getParkingAvailability;
  const originalRunBookingLifecycleMaintenance =
    bookingControllerDependencies.runBookingLifecycleMaintenance;
  const parkingSlotId = new mongoose.Types.ObjectId().toString();

  ParkingSlot.findById = async () => ({
    _id: parkingSlotId,
    availableSlots: 2,
    pricePerHour: 60,
    status: "active",
  });
  bookingControllerDependencies.getParkingAvailability = async () => ({
    activeParkingSpots: [{ _id: new mongoose.Types.ObjectId().toString() }],
    firstAvailableSpot: null,
  });
  bookingControllerDependencies.runBookingLifecycleMaintenance = async () => ({
    completedCount: 0,
    expiredCount: 0,
  });

  try {
    const req = {
      body: {
        parkingSlotId,
        startTime: "2026-03-25T10:00:00.000Z",
        endTime: "2026-03-25T12:00:00.000Z",
        spotPreference: "nearest",
      },
      user: {
        id: new mongoose.Types.ObjectId().toString(),
      },
    };
    const res = createMockResponse();
    const next = createNextCollector();

    await createBooking(req, res, next);

    assert.equal(next.error(), null);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "All slots are booked for this time range");
  } finally {
    ParkingSlot.findById = originalFindById;
    bookingControllerDependencies.getParkingAvailability =
      originalGetParkingAvailability;
    bookingControllerDependencies.runBookingLifecycleMaintenance =
      originalRunBookingLifecycleMaintenance;
  }
});

test("createBooking reserves the next available spot when the first one is locked", async () => {
  const originalParkingFindById = ParkingSlot.findById;
  const originalBookingFindById = Booking.findById;
  const originalBookingFindOne = Booking.findOne;
  const originalBookingCreate = Booking.create;
  const originalParkingSpotFindOneAndUpdate = ParkingSpot.findOneAndUpdate;
  const originalGetParkingAvailability =
    bookingControllerDependencies.getParkingAvailability;
  const originalRunBookingLifecycleMaintenance =
    bookingControllerDependencies.runBookingLifecycleMaintenance;
  const parkingSlotId = new mongoose.Types.ObjectId().toString();
  const lockedSpotId = new mongoose.Types.ObjectId().toString();
  const fallbackSpotId = new mongoose.Types.ObjectId().toString();
  const createdBookingId = new mongoose.Types.ObjectId().toString();
  let createdBookingPayload = null;

  ParkingSlot.findById = async () => ({
    _id: parkingSlotId,
    availableSlots: 2,
    pricePerHour: 60,
    status: "active",
  });
  bookingControllerDependencies.getParkingAvailability = async () => ({
    activeParkingSpots: [
      { _id: lockedSpotId, spotType: "standard" },
      { _id: fallbackSpotId, spotType: "standard" },
    ],
    firstAvailableSpot: { _id: lockedSpotId, spotType: "standard" },
    preferredAvailableSpots: [
      { _id: lockedSpotId, spotType: "standard" },
      { _id: fallbackSpotId, spotType: "standard" },
    ],
  });
  bookingControllerDependencies.runBookingLifecycleMaintenance = async () => ({
    completedCount: 0,
    expiredCount: 0,
  });
  ParkingSpot.findOneAndUpdate = (query) => {
    if (!query.$or) {
      return null;
    }

    return {
      select: async () => {
        if (query._id === lockedSpotId) {
          return null;
        }

        if (query._id === fallbackSpotId) {
          return { _id: fallbackSpotId };
        }

        return null;
      },
    };
  };
  Booking.findOne = () => ({
    select: async () => null,
  });
  Booking.create = async (payload) => {
    createdBookingPayload = payload;
    return {
      _id: createdBookingId,
      ...payload,
    };
  };
  Booking.findById = () => {
    const populatedBooking = {
      _id: createdBookingId,
      parkingSpot: {
        _id: fallbackSpotId,
      },
      populate() {
        return this;
      },
    };

    return populatedBooking;
  };

  try {
    const req = {
      body: {
        parkingSlotId,
        startTime: "2026-03-25T10:00:00.000Z",
        endTime: "2026-03-25T12:00:00.000Z",
        spotPreference: "nearest",
      },
      user: {
        id: new mongoose.Types.ObjectId().toString(),
      },
    };
    const res = createMockResponse();
    const next = createNextCollector();

    await createBooking(req, res, next);

    assert.equal(next.error(), null);
    assert.equal(res.statusCode, 201);
    assert.equal(createdBookingPayload?.parkingSpot, fallbackSpotId);
    assert.equal(res.body?.booking?.parkingSpot?._id, fallbackSpotId);
  } finally {
    ParkingSlot.findById = originalParkingFindById;
    Booking.findById = originalBookingFindById;
    Booking.findOne = originalBookingFindOne;
    Booking.create = originalBookingCreate;
    ParkingSpot.findOneAndUpdate = originalParkingSpotFindOneAndUpdate;
    bookingControllerDependencies.getParkingAvailability =
      originalGetParkingAvailability;
    bookingControllerDependencies.runBookingLifecycleMaintenance =
      originalRunBookingLifecycleMaintenance;
  }
});

test("validateManagedBooking blocks admins from validating another admin's slot", async () => {
  const originalFindById = Booking.findById;
  const originalRunBookingLifecycleMaintenance =
    adminControllerDependencies.runBookingLifecycleMaintenance;
  const bookingId = new mongoose.Types.ObjectId().toString();

  Booking.findById = () => ({
    populate: async () => ({
      _id: bookingId,
      parkingSlot: {
        owner: new mongoose.Types.ObjectId(),
        title: "Lot A",
      },
      status: "booked",
      validationStatus: "pending",
    }),
  });
  adminControllerDependencies.runBookingLifecycleMaintenance = async () => ({
    completedCount: 0,
    expiredCount: 0,
  });

  try {
    const req = {
      params: {
        id: bookingId,
      },
      user: {
        id: new mongoose.Types.ObjectId().toString(),
        role: "admin",
      },
    };
    const res = createMockResponse();
    const next = createNextCollector();

    await validateManagedBooking(req, res, next);

    assert.equal(next.error(), null);
    assert.equal(res.statusCode, 403);
    assert.equal(
      res.body.message,
      "You can only validate bookings for your own parking slots"
    );
  } finally {
    Booking.findById = originalFindById;
    adminControllerDependencies.runBookingLifecycleMaintenance =
      originalRunBookingLifecycleMaintenance;
  }
});
