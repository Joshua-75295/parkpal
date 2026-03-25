import express from "express";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  addFavoriteParkingSlot,
  createParkingSlot,
  deleteParkingSlot,
  getAvailableSlots,
  getAllParking,
  getMyFavoriteParkingSlotIds,
  getMyParking,
  removeFavoriteParkingSlot,
  updateParkingSlot,
} from "../controllers/parkingController.js";

const router = express.Router();

router.post("/", protect, adminOnly, asyncHandler(createParkingSlot));
router.get("/favorites", protect, asyncHandler(getMyFavoriteParkingSlotIds));
router.post("/:id/favorite", protect, asyncHandler(addFavoriteParkingSlot));
router.delete("/:id/favorite", protect, asyncHandler(removeFavoriteParkingSlot));
router.put("/:id", protect, adminOnly, asyncHandler(updateParkingSlot));
router.delete("/:id", protect, adminOnly, asyncHandler(deleteParkingSlot));
router.get("/my", protect, asyncHandler(getMyParking));
router.get("/available", asyncHandler(getAvailableSlots));
router.get("/", asyncHandler(getAllParking));

export default router;
