import express from "express";
import {
  cancelBooking,
  createBooking,
  getMyBookings,
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { bookingMutationRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/", bookingMutationRateLimiter, protect, asyncHandler(createBooking));
router.get("/my", protect, asyncHandler(getMyBookings));
router.put(
  "/cancel/:id",
  bookingMutationRateLimiter,
  protect,
  asyncHandler(cancelBooking)
);

export default router;
