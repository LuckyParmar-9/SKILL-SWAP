const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },
    isBooked: { type: Boolean, default: false },
  },
  { _id: true }
);

const paidListingSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: String, required: true },
    category: { type: String, default: "General" },
    subCategory: { type: String, default: "" },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: "Beginner",
    },
    mode: {
      type: String,
      enum: ["Online Voice", "Online Video", "Offline"],
      default: "Online Video",
    },
    language: {
      type: String,
      enum: ["Hindi", "English", "Hinglish"],
      default: "English",
    },
    description: { type: String, required: true }, // US-23
    price: { type: Number, required: true, min: 0 }, // US-24
    duration: { type: Number, default: 60 }, // minutes
    slots: [slotSchema], // US-22, US-25
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaidListing", paidListingSchema);
