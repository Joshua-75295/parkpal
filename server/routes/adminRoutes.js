import express from "express";
import {
  createAdmin,
  getManagedAnalytics,
  getManagedBookings,
  listAdmins,
  validateManagedBooking,
} from "../controllers/adminController.js";
import { adminOnly, superAdminOnly } from "../middleware/adminMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminMutationRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.get("/bookings/today", protect, adminOnly, asyncHandler(getManagedBookings));
router.put(
  "/bookings/:id/validate",
  adminMutationRateLimiter,
  protect,
  adminOnly,
  asyncHandler(validateManagedBooking)
);
router.get("/analytics", protect, adminOnly, asyncHandler(getManagedAnalytics));

router.get("/users/admins", protect, superAdminOnly, asyncHandler(listAdmins));
router.post(
  "/users/admins",
  adminMutationRateLimiter,
  protect,
  superAdminOnly,
  asyncHandler(createAdmin)
);

export default router;
