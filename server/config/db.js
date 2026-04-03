import mongoose from "mongoose";

const DEFAULT_MONGO_RETRY_DELAY_MS = 5000;
const DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS = 10000;

const parsePositiveInteger = (value, fallbackValue) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
};

const wait = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const createConnectionState = () => ({
  attemptCount: 0,
  connectedAt: null,
  host: "",
  lastError: "",
  lastErrorAt: null,
  nextRetryAt: null,
  status: "idle",
});

const databaseConnectionState = createConnectionState();

let connectionListenersAttached = false;
let connectionPromise = null;

const getMongoRetryDelayMs = () =>
  parsePositiveInteger(
    process.env.MONGO_RETRY_DELAY_MS,
    DEFAULT_MONGO_RETRY_DELAY_MS
  );

const getMongoServerSelectionTimeoutMs = () =>
  parsePositiveInteger(
    process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS
  );

const updateConnectionState = (updates) => {
  Object.assign(databaseConnectionState, updates);
};

const recordConnectionError = (error, retryDelayMs = 0) => {
  const retryAt =
    retryDelayMs > 0 ? new Date(Date.now() + retryDelayMs).toISOString() : null;

  updateConnectionState({
    lastError: error?.message ?? "Unknown MongoDB connection error",
    lastErrorAt: new Date().toISOString(),
    nextRetryAt: retryAt,
    status: "error",
  });
};

const attachConnectionListeners = () => {
  if (connectionListenersAttached) {
    return;
  }

  connectionListenersAttached = true;

  mongoose.connection.on("connected", () => {
    updateConnectionState({
      connectedAt: new Date().toISOString(),
      host: mongoose.connection.host || "",
      lastError: "",
      lastErrorAt: null,
      nextRetryAt: null,
      status: "ready",
    });
  });

  mongoose.connection.on("disconnected", () => {
    updateConnectionState({
      lastError:
        databaseConnectionState.lastError || "MongoDB connection lost.",
      lastErrorAt:
        databaseConnectionState.lastErrorAt || new Date().toISOString(),
      nextRetryAt: null,
      status: "degraded",
    });

    if (!connectionPromise && process.env.MONGO_URI) {
      connectDB().catch(() => null);
    }
  });

  mongoose.connection.on("error", (error) => {
    recordConnectionError(error);
  });
};

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

export const getDatabaseHealth = () => ({
  ...databaseConnectionState,
  isReady: isDatabaseReady(),
  readyState: mongoose.connection.readyState,
});

export const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is missing. Add it to your project .env file before starting the server."
    );
  }

  attachConnectionListeners();

  if (isDatabaseReady()) {
    updateConnectionState({
      host: mongoose.connection.host || databaseConnectionState.host,
      nextRetryAt: null,
      status: "ready",
    });

    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const retryDelayMs = getMongoRetryDelayMs();
  const serverSelectionTimeoutMs = getMongoServerSelectionTimeoutMs();

  connectionPromise = (async () => {
    while (!isDatabaseReady()) {
      const nextAttempt = databaseConnectionState.attemptCount + 1;

      updateConnectionState({
        attemptCount: nextAttempt,
        nextRetryAt: null,
        status: "connecting",
      });

      try {
        const connection = await mongoose.connect(process.env.MONGO_URI, {
          serverSelectionTimeoutMS: serverSelectionTimeoutMs,
        });

        updateConnectionState({
          connectedAt: new Date().toISOString(),
          host: connection.connection.host || "",
          lastError: "",
          lastErrorAt: null,
          nextRetryAt: null,
          status: "ready",
        });

        console.log(`MongoDB Connected: ${connection.connection.host}`);
        return connection;
      } catch (error) {
        recordConnectionError(error, retryDelayMs);

        console.error(
          `DB Error: ${error.message}. Retrying in ${Math.round(
            retryDelayMs / 1000
          )}s`
        );

        await wait(retryDelayMs);
      }
    }

    return mongoose.connection;
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
};

export const resetDatabaseHealthForTests = () => {
  Object.assign(databaseConnectionState, createConnectionState());
};
