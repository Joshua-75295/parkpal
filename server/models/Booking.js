import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parkingSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSlot",
      required: true,
    },
    parkingSpot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSpot",
      default: null,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    spotPreference: {
      type: String,
      enum: ["nearest", "standard", "vip", "accessible"],
      default: "nearest",
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["booked", "cancelled", "completed"],
      default: "booked",
    },
    validationStatus: {
      type: String,
      enum: ["pending", "validated", "expired"],
      default: "pending",
    },
    validatedAt: {
      type: Date,
      default: null,
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      enum: ["user_cancelled", "expired", null],
      default: null,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ parkingSlot: 1, status: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ parkingSpot: 1, status: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ status: 1, validationStatus: 1, expiresAt: 1 });

export default mongoose.model("Booking", bookingSchema);
