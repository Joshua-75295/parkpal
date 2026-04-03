import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  computeTravelMatrix,
  computeTravelRoutes,
} from "../controllers/routingController.js";

const router = express.Router();

router.post("/matrix", protect, asyncHandler(computeTravelMatrix));
router.post("/routes", protect, asyncHandler(computeTravelRoutes));

export default router;
