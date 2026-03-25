import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import parkingRoutes from "./routes/parkingRoutes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorMiddleware.js";
import { apiRateLimiter } from "./middleware/rateLimitMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDirectory = path.resolve(__dirname, "uploads");
const MAX_JSON_BODY_SIZE = "8mb";

export const getAllowedOrigins = () =>
  (
    process.env.CLIENT_ORIGIN ??
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const createApp = (allowedOrigins = getAllowedOrigins()) => {
  const app = express();

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
  app.use("/api", apiRateLimiter);
  app.use("/uploads", express.static(uploadsDirectory));

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/parking", parkingRoutes);
  app.use("/api/bookings", bookingRoutes);

  app.get("/", (_req, res) => {
    res.send("ParkPal API running...");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
