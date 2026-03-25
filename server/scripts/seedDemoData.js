import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import Booking from "../models/Booking.js";
import ParkingSlot from "../models/ParkingSlot.js";
import ParkingSpot from "../models/ParkingSpot.js";
import User from "../models/User.js";
import { computeBookingExpiryTime } from "../utils/bookingLifecycle.js";
import {
  ensureParkingSpots,
  getParkingAvailability,
} from "../utils/parkingSpotHelpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPaths = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
];

const envFilePath = envPaths.find((envPath) => fs.existsSync(envPath));
dotenv.config(envFilePath ? { path: envFilePath } : undefined);

const ADMIN_PASSWORD = "Mall@123";
const USER_PASSWORD = "User@123";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";
const MS_PER_MINUTE = 60 * 1000;

const hasFlag = (flag) => process.argv.slice(2).includes(flag);

const shouldForceBookings = hasFlag("--force-bookings");
const shouldSkipBookings = hasFlag("--no-bookings");
const shouldShowHelp = hasFlag("--help");

const superAdminSeed = {
  name: "ParkPal Super Admin",
  email: "superadmin@parkpal.test",
  password: SUPER_ADMIN_PASSWORD,
  role: "super_admin",
};

const mallAdminSeeds = [
  {
    name: "Phoenix Mall Guntur User",
    email: "phnxgntgtroad@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "Phoenix Mall Guntur",
      address: "MG Road, Brodipet, Guntur, Andhra Pradesh",
      lat: 16.3067,
      lng: 80.4365,
      pricePerHour: 45,
      availableSlots: 24,
      allocationConfig: {
        accessibleSpotCount: 2,
        vipSpotCount: 4,
      },
    },
  },
  {
    name: "Naaz Centre Guntur User",
    email: "naazgntctr@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "Naaz Centre Guntur",
      address: "Lakshmipuram Main Road, Guntur, Andhra Pradesh",
      lat: 16.3052,
      lng: 80.4437,
      pricePerHour: 35,
      availableSlots: 16,
      allocationConfig: {
        accessibleSpotCount: 1,
        vipSpotCount: 2,
      },
    },
  },
  {
    name: "PVP Mall Vijayawada User",
    email: "pvpvjamgrd@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "PVP Square Vijayawada",
      address: "MG Road, Labbipet, Vijayawada, Andhra Pradesh",
      lat: 16.5062,
      lng: 80.648,
      pricePerHour: 50,
      availableSlots: 28,
      allocationConfig: {
        accessibleSpotCount: 2,
        vipSpotCount: 5,
      },
    },
  },
  {
    name: "Trendset Mall Benz Circle User",
    email: "trndstvjabnzc@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "Trendset Mall Benz Circle",
      address: "Benz Circle, Vijayawada, Andhra Pradesh",
      lat: 16.5069,
      lng: 80.6595,
      pricePerHour: 55,
      availableSlots: 20,
      allocationConfig: {
        accessibleSpotCount: 1,
        vipSpotCount: 4,
      },
    },
  },
  {
    name: "LEPL Centro Vijayawada User",
    email: "leplvjamgrd@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "LEPL Centro Vijayawada",
      address: "Gunadala, Vijayawada, Andhra Pradesh",
      lat: 16.5278,
      lng: 80.6679,
      pricePerHour: 40,
      availableSlots: 18,
      allocationConfig: {
        accessibleSpotCount: 1,
        vipSpotCount: 3,
      },
    },
  },
  {
    name: "CMR Central Vizag User",
    email: "cmrvizmddlp@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "CMR Central Vizag",
      address: "Maddilapalem, Visakhapatnam, Andhra Pradesh",
      lat: 17.7412,
      lng: 83.3176,
      pricePerHour: 60,
      availableSlots: 26,
      allocationConfig: {
        accessibleSpotCount: 2,
        vipSpotCount: 5,
      },
    },
  },
  {
    name: "Dmart Vizag Madhurawada User",
    email: "dmartvizmadhw@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "Dmart Vizag Madhurawada",
      address: "Madhurawada, Visakhapatnam, Andhra Pradesh",
      lat: 17.8286,
      lng: 83.3572,
      pricePerHour: 30,
      availableSlots: 22,
      allocationConfig: {
        accessibleSpotCount: 1,
        vipSpotCount: 2,
      },
    },
  },
  {
    name: "Ongole Dmart User",
    email: "dmartongtrnkrd@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "Ongole Dmart",
      address: "Trunk Road, Ongole, Andhra Pradesh",
      lat: 15.5057,
      lng: 80.0499,
      pricePerHour: 25,
      availableSlots: 14,
      allocationConfig: {
        accessibleSpotCount: 1,
        vipSpotCount: 1,
      },
    },
  },
  {
    name: "Nellore Felicity Mall User",
    email: "mgbnlrctr@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "MGB Felicity Mall Nellore",
      address: "Magunta Layout, Nellore, Andhra Pradesh",
      lat: 14.4426,
      lng: 79.9865,
      pricePerHour: 38,
      availableSlots: 18,
      allocationConfig: {
        accessibleSpotCount: 1,
        vipSpotCount: 3,
      },
    },
  },
  {
    name: "Tirupati Garuda Mall User",
    email: "grdtrpaktp@gmail.com",
    password: ADMIN_PASSWORD,
    role: "admin",
    slot: {
      title: "Garuda Mall Tirupati",
      address: "Air Bypass Road, Tirupati, Andhra Pradesh",
      lat: 13.6355,
      lng: 79.4192,
      pricePerHour: 42,
      availableSlots: 16,
      allocationConfig: {
        accessibleSpotCount: 1,
        vipSpotCount: 2,
      },
    },
  },
];

const demoUserSeeds = [
  {
    name: "Ananya Reddy",
    email: "ananya@parkpal.test",
    password: USER_PASSWORD,
    role: "user",
  },
  {
    name: "Bharat Kumar",
    email: "bharat@parkpal.test",
    password: USER_PASSWORD,
    role: "user",
  },
  {
    name: "Charan Teja",
    email: "charan@parkpal.test",
    password: USER_PASSWORD,
    role: "user",
  },
  {
    name: "Divya Sri",
    email: "divya@parkpal.test",
    password: USER_PASSWORD,
    role: "user",
  },
  {
    name: "Harsha Vardhan",
    email: "harsha@parkpal.test",
    password: USER_PASSWORD,
    role: "user",
  },
  {
    name: "Keerthi Priya",
    email: "keerthi@parkpal.test",
    password: USER_PASSWORD,
    role: "user",
  },
];

const normalizeEmail = (email) => email.trim().toLowerCase();

const pickByIndex = (items, index) => items[index % items.length];

const buildDateAt = (dayOffset, hours, minutes, durationMinutes) => {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hours, minutes, 0, 0);

  const end = new Date(start.getTime() + durationMinutes * MS_PER_MINUTE);

  return { start, end };
};

const buildRelativeDateRange = (startOffsetMinutes, durationMinutes) => {
  const start = new Date(Date.now() + startOffsetMinutes * MS_PER_MINUTE);
  start.setSeconds(0, 0);

  const end = new Date(start.getTime() + durationMinutes * MS_PER_MINUTE);

  return { start, end };
};

const printHelp = () => {
  console.log("Seed ParkPal demo data");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/seedDemoData.js");
  console.log("  node scripts/seedDemoData.js --force-bookings");
  console.log("  node scripts/seedDemoData.js --no-bookings");
  console.log("");
  console.log("Flags:");
  console.log(
    "  --force-bookings  Replace bookings that belong to the demo users or demo parking slots."
  );
  console.log(
    "  --no-bookings     Seed only users and parking slots, leaving bookings untouched."
  );
};

const upsertUser = async ({ email, name, password, role }) => {
  const normalizedEmail = normalizeEmail(email);
  const hashedPassword = await bcrypt.hash(password, 10);

  return User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const upsertParkingSlot = async (slotSeed, ownerId) => {
  const slot = await ParkingSlot.findOneAndUpdate(
    { title: slotSeed.title },
    {
      $set: {
        title: slotSeed.title,
        imageUrl: "",
        location: {
          address: slotSeed.address,
          lat: slotSeed.lat,
          lng: slotSeed.lng,
        },
        pricePerHour: slotSeed.pricePerHour,
        availableSlots: slotSeed.availableSlots,
        allocationConfig: slotSeed.allocationConfig,
        status: "active",
        owner: ownerId,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  await ensureParkingSpots(slot);
  return slot;
};

const findPreferredSpot = (parkingSpots, spotPreference) => {
  if (!Array.isArray(parkingSpots) || parkingSpots.length === 0) {
    return null;
  }

  if (!spotPreference || spotPreference === "nearest") {
    return parkingSpots[0];
  }

  return (
    parkingSpots.find((spot) => spot.spotType === spotPreference) ||
    parkingSpots[0]
  );
};

const buildDemoBookingTemplates = (now = new Date()) =>
  mallAdminSeeds.flatMap((mallAdminSeed, index) => {
    const primaryUser = pickByIndex(demoUserSeeds, index);
    const secondaryUser = pickByIndex(demoUserSeeds, index + 1);
    const tertiaryUser = pickByIndex(demoUserSeeds, index + 2);
    const quaternaryUser = pickByIndex(demoUserSeeds, index + 3);
    const { start: activeValidatedStart, end: activeValidatedEnd } =
      buildRelativeDateRange(-45, 120);
    const { start: activePendingStart, end: activePendingEnd } =
      buildRelativeDateRange(-10, 140);
    const { start: completedStart, end: completedEnd } = buildDateAt(
      -6 + (index % 4),
      10 + (index % 3),
      0,
      120
    );
    const { start: cancelledStart, end: cancelledEnd } = buildDateAt(
      -3 + (index % 3),
      17 + (index % 2),
      30,
      90
    );
    const { start: expiredStart, end: expiredEnd } = buildDateAt(
      -1 - (index % 2),
      8 + (index % 4),
      15,
      75
    );

    return [
      {
        slotTitle: mallAdminSeed.slot.title,
        userEmail: primaryUser.email,
        validatorEmail: mallAdminSeed.email,
        start: completedStart,
        end: completedEnd,
        spotPreference: index % 2 === 0 ? "standard" : "nearest",
        status: "completed",
        validationStatus: "validated",
        validatedAt: new Date(completedStart.getTime() + 20 * MS_PER_MINUTE),
      },
      {
        slotTitle: mallAdminSeed.slot.title,
        userEmail: secondaryUser.email,
        start: cancelledStart,
        end: cancelledEnd,
        spotPreference: index % 3 === 0 ? "vip" : "nearest",
        status: "cancelled",
        validationStatus: "pending",
        cancelledAt: new Date(cancelledStart.getTime() + 25 * MS_PER_MINUTE),
        cancellationReason: "user_cancelled",
      },
      {
        slotTitle: mallAdminSeed.slot.title,
        userEmail: tertiaryUser.email,
        start: expiredStart,
        end: expiredEnd,
        spotPreference: "nearest",
        status: "cancelled",
        validationStatus: "expired",
        expiresAt: new Date(expiredStart.getTime() + 15 * MS_PER_MINUTE),
        cancelledAt: new Date(expiredStart.getTime() + 20 * MS_PER_MINUTE),
        cancellationReason: "expired",
      },
      {
        slotTitle: mallAdminSeed.slot.title,
        userEmail: quaternaryUser.email,
        validatorEmail: mallAdminSeed.email,
        start: activeValidatedStart,
        end: activeValidatedEnd,
        spotPreference: index % 2 === 0 ? "vip" : "nearest",
        status: "booked",
        validationStatus: "validated",
        validatedAt: new Date(now.getTime() - 20 * MS_PER_MINUTE),
      },
      {
        slotTitle: mallAdminSeed.slot.title,
        userEmail: primaryUser.email,
        start: activePendingStart,
        end: activePendingEnd,
        spotPreference: index % 4 === 0 ? "accessible" : "nearest",
        status: "booked",
        validationStatus: "pending",
        expiresAt: new Date(now.getTime() + 6 * 60 * MS_PER_MINUTE),
      },
    ];
  });

const assignFavoriteParkingSlots = async (parkingSlotsByTitle, demoUsersByEmail) => {
  const favoriteConfig = {
    "ananya@parkpal.test": [
      "Phoenix Mall Guntur",
      "PVP Square Vijayawada",
      "CMR Central Vizag",
    ],
    "bharat@parkpal.test": [
      "Trendset Mall Benz Circle",
      "Dmart Vizag Madhurawada",
      "Garuda Mall Tirupati",
    ],
    "charan@parkpal.test": [
      "Naaz Centre Guntur",
      "LEPL Centro Vijayawada",
      "Ongole Dmart",
    ],
    "divya@parkpal.test": [
      "MGB Felicity Mall Nellore",
      "PVP Square Vijayawada",
    ],
  };

  for (const [email, favoriteTitles] of Object.entries(favoriteConfig)) {
    const user = demoUsersByEmail.get(normalizeEmail(email));

    if (!user) {
      continue;
    }

    const favoriteIds = favoriteTitles
      .map((title) => parkingSlotsByTitle.get(title)?._id)
      .filter(Boolean);

    await User.findByIdAndUpdate(user._id, {
      $set: { favoriteParkingSlots: favoriteIds },
    });
  }
};

const createDemoBookings = async ({
  adminUsersByEmail,
  demoUsersByEmail,
  parkingSlotsByTitle,
}) => {
  const templates = buildDemoBookingTemplates();
  let createdCount = 0;

  for (const template of templates) {
    const parkingSlot = parkingSlotsByTitle.get(template.slotTitle);
    const bookingUser = demoUsersByEmail.get(normalizeEmail(template.userEmail));

    if (!parkingSlot || !bookingUser) {
      continue;
    }

    const parkingSpots = await ParkingSpot.find({
      parkingSlot: parkingSlot._id,
      isActive: true,
    }).sort({ distanceFromEntrance: 1, spotNumber: 1 });

    if (parkingSpots.length === 0) {
      continue;
    }

    let parkingSpot = null;

    if (template.status === "booked") {
      const availability = await getParkingAvailability(
        parkingSlot,
        template.start,
        template.end,
        template.spotPreference
      );

      parkingSpot =
        availability.firstAvailableSpot ||
        findPreferredSpot(parkingSpots, template.spotPreference);
    } else {
      parkingSpot = findPreferredSpot(parkingSpots, template.spotPreference);
    }

    if (!parkingSpot) {
      continue;
    }

    const durationInHours =
      (template.end.getTime() - template.start.getTime()) / (60 * 60 * 1000);
    const totalPrice = Math.ceil(durationInHours * parkingSlot.pricePerHour);
    const validatedBy = template.validatorEmail
      ? adminUsersByEmail.get(normalizeEmail(template.validatorEmail))?._id ?? null
      : null;

    await Booking.create({
      user: bookingUser._id,
      parkingSlot: parkingSlot._id,
      parkingSpot: parkingSpot._id,
      startTime: template.start,
      endTime: template.end,
      spotPreference: template.spotPreference,
      totalPrice,
      status: template.status,
      validationStatus: template.validationStatus,
      validatedAt: template.validatedAt ?? null,
      validatedBy,
      expiresAt:
        template.expiresAt ??
        (template.status === "booked" && template.validationStatus === "pending"
          ? computeBookingExpiryTime(template.start, template.end)
          : null),
      cancelledAt: template.cancelledAt ?? null,
      cancellationReason: template.cancellationReason ?? null,
    });

    createdCount += 1;
  }

  return createdCount;
};

const logCredentials = () => {
  console.log("");
  console.log("Demo accounts ready:");
  console.log(
    `  Super Admin: ${superAdminSeed.email} / ${superAdminSeed.password}`
  );
  console.log(`  Mall Admins: use any seeded mall admin email / ${ADMIN_PASSWORD}`);
  console.log(`  Demo Users: use any @parkpal.test email / ${USER_PASSWORD}`);
};

const main = async () => {
  if (shouldShowHelp) {
    printHelp();
    return;
  }

  await connectDB();

  const adminUsersByEmail = new Map();
  const parkingSlotsByTitle = new Map();
  const demoUsersByEmail = new Map();

  const seededSuperAdmin = await upsertUser(superAdminSeed);
  adminUsersByEmail.set(normalizeEmail(seededSuperAdmin.email), seededSuperAdmin);

  for (const mallAdminSeed of mallAdminSeeds) {
    const adminUser = await upsertUser(mallAdminSeed);
    adminUsersByEmail.set(normalizeEmail(adminUser.email), adminUser);

    const parkingSlot = await upsertParkingSlot(mallAdminSeed.slot, adminUser._id);
    parkingSlotsByTitle.set(parkingSlot.title, parkingSlot);
  }

  for (const demoUserSeed of demoUserSeeds) {
    const demoUser = await upsertUser(demoUserSeed);
    demoUsersByEmail.set(normalizeEmail(demoUser.email), demoUser);
  }

  await assignFavoriteParkingSlots(parkingSlotsByTitle, demoUsersByEmail);

  const demoUserIds = Array.from(demoUsersByEmail.values()).map(
    (demoUser) => demoUser._id
  );
  const demoParkingIds = Array.from(parkingSlotsByTitle.values()).map(
    (parkingSlot) => parkingSlot._id
  );
  const demoBookingScope = {
    $or: [
      { user: { $in: demoUserIds } },
      { parkingSlot: { $in: demoParkingIds } },
    ],
  };

  let createdBookingCount = 0;

  if (shouldSkipBookings) {
    console.log("Skipped booking seeding because --no-bookings was provided.");
  } else {
    const existingDemoBookingCount = await Booking.countDocuments(demoBookingScope);

    if (existingDemoBookingCount > 0 && !shouldForceBookings) {
      console.log(
        "Skipped demo bookings because matching demo bookings already exist. Re-run with --force-bookings to replace them."
      );
    } else {
      if (shouldForceBookings && existingDemoBookingCount > 0) {
        await Booking.deleteMany(demoBookingScope);
        console.log(`Deleted ${existingDemoBookingCount} existing demo bookings.`);
      }

      createdBookingCount = await createDemoBookings({
        adminUsersByEmail,
        demoUsersByEmail,
        parkingSlotsByTitle,
      });
    }
  }

  console.log("");
  console.log("Demo data seeding finished.");
  console.log(`  Super admins: 1`);
  console.log(`  Mall admins: ${mallAdminSeeds.length}`);
  console.log(`  Demo users: ${demoUserSeeds.length}`);
  console.log(`  Parking slots: ${mallAdminSeeds.length}`);
  console.log(`  New demo bookings: ${createdBookingCount}`);
  logCredentials();
};

try {
  await main();
} catch (error) {
  console.error("Failed to seed demo data:", error.message);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([Booking.db.close()]);
}
