import { createHttpError } from "../utils/httpError.js";

const activeStores = new Set();

const getClientKey = (req) =>
  req.ip ||
  req.headers["x-forwarded-for"] ||
  req.connection?.remoteAddress ||
  "anonymous";

const pruneExpiredEntries = (store, now) => {
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
};

export const resetRateLimitStores = () => {
  for (const store of activeStores) {
    store.clear();
  }
};

export const createRateLimiter = ({
  code,
  keyPrefix,
  max,
  message,
  windowMs,
}) => {
  const store = new Map();
  activeStores.add(store);

  return (req, res, next) => {
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const now = Date.now();
    pruneExpiredEntries(store, now);

    const key = `${keyPrefix}:${getClientKey(req)}`;
    const currentEntry = store.get(key);
    const entry =
      currentEntry && currentEntry.resetAt > now
        ? currentEntry
        : {
            count: 0,
            resetAt: now + windowMs,
          };

    entry.count += 1;
    store.set(key, entry);

    const retryAfterSeconds = Math.max(
      Math.ceil((entry.resetAt - now) / 1000),
      1
    );

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(max - entry.count, 0));
    res.setHeader("X-RateLimit-Reset", retryAfterSeconds);

    if (entry.count > max) {
      res.setHeader("Retry-After", retryAfterSeconds);

      return next(
        createHttpError(429, message, {
          code,
          details: {
            retryAfterSeconds,
          },
        })
      );
    }

    return next();
  };
};

export const apiRateLimiter = createRateLimiter({
  code: "API_RATE_LIMITED",
  keyPrefix: "api",
  max: 300,
  message: "Too many requests. Please slow down and try again shortly.",
  windowMs: 15 * 60 * 1000,
});

export const authRateLimiter = createRateLimiter({
  code: "AUTH_RATE_LIMITED",
  keyPrefix: "auth",
  max: 15,
  message: "Too many authentication attempts. Please try again in a few minutes.",
  windowMs: 15 * 60 * 1000,
});

export const bookingMutationRateLimiter = createRateLimiter({
  code: "BOOKING_RATE_LIMITED",
  keyPrefix: "booking",
  max: 40,
  message: "Too many booking actions. Please wait a moment before trying again.",
  windowMs: 15 * 60 * 1000,
});

export const adminMutationRateLimiter = createRateLimiter({
  code: "ADMIN_RATE_LIMITED",
  keyPrefix: "admin",
  max: 60,
  message: "Too many admin actions. Please pause briefly before continuing.",
  windowMs: 15 * 60 * 1000,
});
