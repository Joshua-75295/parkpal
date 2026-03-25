import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { createHttpError } from "../utils/httpError.js";
import {
  ACCESS_COOKIE_NAME,
  getCookieValue,
  verifyAccessToken,
} from "../utils/authSession.js";

const extractToken = (req) => {
  const cookieToken = getCookieValue(req, ACCESS_COOKIE_NAME);
  const authHeader = req.headers.authorization;
  const headerToken = req.headers["x-auth-token"];

  if (cookieToken) {
    return cookieToken;
  }

  if (authHeader) {
    const parts = authHeader.trim().split(/\s+/);

    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1];
    }

    if (parts.length === 1) {
      return parts[0];
    }
  }

  if (headerToken) {
    return headerToken;
  }

  return null;
};

export const protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    const sentLoginBody = req.body?.email || req.body?.password;

    return next(
      createHttpError(
        401,
        sentLoginBody
        ? "This route needs an authenticated session, not login credentials. Sign in first and send the session cookie or Authorization header."
        : "No active session found. Sign in again and send the session cookie or Authorization header.",
        {
          code: "AUTH_REQUIRED",
        }
      )
    );
  }

  try {
    const decoded = verifyAccessToken(token);

    if (decoded.type !== "access") {
      return next(
        createHttpError(401, "Invalid access token", {
          code: "INVALID_TOKEN",
        })
      );
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(
        createHttpError(401, "User not found for this session", {
          code: "USER_NOT_FOUND",
        })
      );
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || "user",
    };

    return next();
  } catch (error) {
    if (error?.message?.includes("missing. Add it to your .env file.")) {
      return next(
        createHttpError(500, error.message, {
          code: "AUTH_CONFIG_MISSING",
        })
      );
    }

    if (error instanceof jwt.TokenExpiredError) {
      return next(
        createHttpError(401, "Access token expired", {
          code: "ACCESS_TOKEN_EXPIRED",
        })
      );
    }

    return next(
      createHttpError(401, "Not authorized, access token failed", {
        code: "INVALID_TOKEN",
      })
    );
  }
};
