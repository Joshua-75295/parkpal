import crypto from "crypto";
import jwt from "jsonwebtoken";

export const ACCESS_COOKIE_NAME = "parkpal_access";
export const REFRESH_COOKIE_NAME = "parkpal_refresh";

export const ACCESS_TOKEN_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
export const REFRESH_TOKEN_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

const DEFAULT_ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const durationPattern = /^(\d+)(ms|s|m|h|d)$/i;

const durationUnits = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const resolveSecret = (primaryKey, fallbackKey = "JWT_SECRET") => {
  const secret = process.env[primaryKey] || process.env[fallbackKey];

  if (!secret) {
    throw new Error(`${primaryKey} is missing. Add it to your .env file.`);
  }

  return secret;
};

export const parseDurationToMs = (value, fallbackMs) => {
  if (!value || typeof value !== "string") {
    return fallbackMs;
  }

  const normalizedValue = value.trim().toLowerCase();
  const durationMatch = normalizedValue.match(durationPattern);

  if (!durationMatch) {
    return fallbackMs;
  }

  const [, amount, unit] = durationMatch;
  return Number(amount) * durationUnits[unit];
};

export const ACCESS_COOKIE_MAX_AGE_MS = parseDurationToMs(
  ACCESS_TOKEN_EXPIRES_IN,
  DEFAULT_ACCESS_MAX_AGE_MS
);

export const REFRESH_COOKIE_MAX_AGE_MS = parseDurationToMs(
  REFRESH_TOKEN_EXPIRES_IN,
  DEFAULT_REFRESH_MAX_AGE_MS
);

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  path: "/",
};

export const accessCookieOptions = {
  ...baseCookieOptions,
  maxAge: ACCESS_COOKIE_MAX_AGE_MS,
};

export const refreshCookieOptions = {
  ...baseCookieOptions,
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
};

export const signAccessToken = (userId) =>
  jwt.sign(
    {
      id: userId.toString(),
      type: "access",
    },
    resolveSecret("JWT_ACCESS_SECRET"),
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    }
  );

export const signRefreshToken = (userId) =>
  jwt.sign(
    {
      id: userId.toString(),
      type: "refresh",
    },
    resolveSecret("JWT_REFRESH_SECRET"),
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, resolveSecret("JWT_ACCESS_SECRET"));

export const verifyRefreshToken = (token) =>
  jwt.verify(token, resolveSecret("JWT_REFRESH_SECRET"));

export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
};

export const getCookieValue = (req, cookieName) => {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return "";
  }

  for (const cookiePart of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");

    if (rawName === cookieName) {
      return decodeURIComponent(rawValueParts.join("="));
    }
  }

  return "";
};

export const toUserPayload = (user) => {
  const id = user?.id?.toString?.() ?? user?._id?.toString?.() ?? "";

  return {
    id,
    _id: id,
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "user",
  };
};

export const buildAuthResponse = (user) => ({
  user: toUserPayload(user),
  session: {
    strategy: "httpOnly-cookies",
    accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
  },
});
