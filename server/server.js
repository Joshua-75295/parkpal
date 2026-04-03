import dotenv from "dotenv";
import { createServer } from "http";
import { connectDB, isDatabaseReady } from "./config/db.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createApp, getAllowedOrigins } from "./app.js";
import { runBookingLifecycleMaintenance } from "./utils/bookingLifecycle.js";
import { initializeRealtime } from "./utils/realtime.js";
// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPaths = [
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "../.env"),
];

const envFilePath = envPaths.find((envPath) => fs.existsSync(envPath));
dotenv.config(envFilePath ? { path: envFilePath } : undefined);

const allowedOrigins = getAllowedOrigins();
const app = createApp(allowedOrigins);
const httpServer = createServer(app);

const PORT = process.env.PORT || 5000;
let maintenanceIntervalId = null;

const startBookingMaintenance = async () => {
  if (maintenanceIntervalId) {
    return;
  }

  if (isDatabaseReady()) {
    await runBookingLifecycleMaintenance();
  }

  maintenanceIntervalId = setInterval(() => {
    if (!isDatabaseReady()) {
      return;
    }

    runBookingLifecycleMaintenance();
  }, 60000);
};

const startServer = async () => {
  initializeRealtime(httpServer, allowedOrigins);

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  try {
    await connectDB();
    await startBookingMaintenance();
  } catch (error) {
    console.error("Server failed to initialize:", error.message);
    process.exit(1);
  }
};

startServer();
