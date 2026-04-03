import cors from "cors";
import express from "express";
import { getDatabaseHealth, isDatabaseReady } from "./config/db.js";
import { getUploadsDirectory } from "./config/storage.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import parkingRoutes from "./routes/parkingRoutes.js";
import routingRoutes from "./routes/routingRoutes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorMiddleware.js";
import { apiRateLimiter } from "./middleware/rateLimitMiddleware.js";
import { createHttpError } from "./utils/httpError.js";

const MAX_JSON_BODY_SIZE = "8mb";

export const getAllowedOrigins = () =>
  (
    process.env.CLIENT_ORIGIN ??
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const defaultAppDependencies = {
  getDatabaseHealth,
  getUploadsDirectory,
  isDatabaseReady,
};

export const createApp = (
  allowedOrigins = getAllowedOrigins(),
  dependencies = defaultAppDependencies
) => {
  const app = express();
  const uploadsDirectory = dependencies.getUploadsDirectory();

  app.use(express.json({ limit: MAX_JSON_BODY_SIZE }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: MAX_JSON_BODY_SIZE,
    })
  );
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("CORS origin not allowed"));
      },
    })
  );
  app.use("/uploads", express.static(uploadsDirectory));

  app.get("/api/health", (_req, res) => {
    const database = dependencies.getDatabaseHealth();
    const serviceReady = dependencies.isDatabaseReady();

    return res.status(serviceReady ? 200 : 503).json({
      database,
      service: {
        status: serviceReady ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use("/api", apiRateLimiter);
  app.use("/api", (_req, _res, next) => {
    if (dependencies.isDatabaseReady()) {
      return next();
    }

    return next(
      createHttpError(
        503,
        "The service is starting up and the database is not ready yet. Please try again shortly.",
        {
          code: "DATABASE_UNAVAILABLE",
          details: dependencies.getDatabaseHealth(),
        }
      )
    );
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/parking", parkingRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/routing", routingRoutes);

  app.get("/", (_req, res) => {
    res.send("ParkPal API running...");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
