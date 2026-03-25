import express from "express";
import {
  getCurrentUser,
  registerUser,
  loginUser,
  logoutUser,
  refreshSession,
} from "../controllers/authController.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { authRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/register", authRateLimiter, asyncHandler(registerUser));
router.post("/login", authRateLimiter, asyncHandler(loginUser));
router.post("/refresh", authRateLimiter, asyncHandler(refreshSession));
router.post("/logout", asyncHandler(logoutUser));
router.get("/me", protect, asyncHandler(getCurrentUser));

export default router;
