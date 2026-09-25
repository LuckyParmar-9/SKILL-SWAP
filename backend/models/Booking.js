const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    learner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "PaidListing", required: true },
    slot: {
      date: String,
      startTime: String,
      endTime: String,
    },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    payment: {
      orderId: { type: String, default: null },
      paymentId: { type: String, default: null },
      status: { type: String, enum: ["unpaid", "paid", "failed"], default: "unpaid" },
      amount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
