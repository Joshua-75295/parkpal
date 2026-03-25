import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
  buildAuthResponse,
  clearAuthCookies,
  getCookieValue,
  hashToken,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  toUserPayload,
  verifyRefreshToken,
} from "../utils/authSession.js";

const issueSession = async (res, user) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  setAuthCookies(res, accessToken, refreshToken);

  await User.findByIdAndUpdate(user._id, {
    $set: {
      refreshTokenHash: hashToken(refreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
    },
  });
};

const clearStoredRefreshSession = async (userId) => {
  if (!userId) {
    return;
  }

  await User.findByIdAndUpdate(userId, {
    $set: {
      refreshTokenHash: "",
      refreshTokenExpiresAt: null,
    },
  });
};

const readRefreshSessionUser = async (refreshToken) => {
  if (!refreshToken) {
    return { error: "Refresh token missing", user: null };
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    if (decoded.type !== "refresh") {
      return { error: "Invalid refresh token", user: null };
    }

    const user = await User.findById(decoded.id).select(
      "+refreshTokenHash +refreshTokenExpiresAt"
    );

    if (!user) {
      return { error: "User not found for this refresh token", user: null };
    }

    const refreshTokenHash = hashToken(refreshToken);
    const hasStoredSession =
      user.refreshTokenHash &&
      user.refreshTokenHash === refreshTokenHash &&
      user.refreshTokenExpiresAt &&
      user.refreshTokenExpiresAt > new Date();

    if (!hasStoredSession) {
      return { error: "Refresh token is no longer valid", user };
    }

    return { error: "", user };
  } catch (error) {
    const isJwtValidationError =
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.NotBeforeError;

    if (!isJwtValidationError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      return { error: "Refresh token expired", user: null };
    }

    return { error: "Refresh token invalid", user: null };
  }
};

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    await issueSession(res, user);

    return res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    return next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    await issueSession(res, user);

    return res.json(buildAuthResponse(user));
  } catch (error) {
    return next(error);
  }
};

export const refreshSession = async (req, res, next) => {
  try {
    const refreshToken = getCookieValue(req, REFRESH_COOKIE_NAME);
    const { error, user } = await readRefreshSessionUser(refreshToken);

    if (error || !user) {
      clearAuthCookies(res);

      return res.status(401).json({
        message: error || "Refresh token invalid",
        code: "REFRESH_TOKEN_INVALID",
      });
    }

    await issueSession(res, user);

    return res.status(200).json(buildAuthResponse(user));
  } catch (error) {
    clearAuthCookies(res);
    return next(error);
  }
};

export const getCurrentUser = async (req, res) =>
  res.status(200).json({
    user: toUserPayload(req.user),
  });

export const logoutUser = async (req, res, next) => {
  try {
    const refreshToken = getCookieValue(req, REFRESH_COOKIE_NAME);
    const { user } = await readRefreshSessionUser(refreshToken);

    if (user?._id) {
      await clearStoredRefreshSession(user._id);
    }

    clearAuthCookies(res);

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    clearAuthCookies(res);
    return next(error);
  }
};
