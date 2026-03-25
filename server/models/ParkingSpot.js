import mongoose from "mongoose";

const parkingSpotSchema = new mongoose.Schema(
  {
    parkingSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSlot",
      required: true,
      index: true,
    },
    spotNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    spotType: {
      type: String,
      enum: ["standard", "vip", "accessible"],
      default: "standard",
    },
    distanceFromEntrance: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    reservationLock: {
      token: {
        type: String,
        default: "",
        select: false,
      },
      expiresAt: {
        type: Date,
        default: null,
        select: false,
      },
    },
  },
  { timestamps: true }
);

parkingSpotSchema.index({ parkingSlot: 1, spotNumber: 1 }, { unique: true });

export default mongoose.model("ParkingSpot", parkingSpotSchema);
