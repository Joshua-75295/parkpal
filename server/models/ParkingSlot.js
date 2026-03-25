import mongoose from "mongoose";

const parkingSlotSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g., "Parking near mall"
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      lat: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },
    },
    pricePerHour: { type: Number, required: true, min: 0 },
    // This remains the configured count sent by clients, while each physical
    // space is now represented by its own ParkingSpot document.
    availableSlots: { type: Number, required: true, min: 0 },
    allocationConfig: {
      accessibleSpotCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      vipSpotCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    status: {
      type: String,
      enum: ["active", "maintenance", "inactive"],
      default: "active",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("ParkingSlot", parkingSlotSchema);
