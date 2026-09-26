const mongoose = require("mongoose");

const paymentLegSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0 }, // rupees, not paise
    orderId: { type: String, default: null },
    paymentId: { type: String, default: null },
    status: {
      type: String,
      // "first" starts "unpaid"; "second" starts "not_due" and only becomes
      // "due" once the provider marks the session completed (see bookings.js)
      enum: ["not_due", "due", "unpaid", "paid", "failed"],
      default: "unpaid",
    },
  },
  { _id: false }
);

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
      // Chosen by the learner the moment they make their first payment —
      // "full" pays the whole price in one go; "split" pays it in two parts.
      plan: { type: String, enum: ["full", "split", null], default: null },
      // Only meaningful when plan === "split". e.g. 40 means the learner
      // pays 40% up front and the remaining 60% once the session is done.
      splitPercent: { type: Number, default: null },
      first: { type: paymentLegSchema, default: () => ({ status: "unpaid" }) },
      second: { type: paymentLegSchema, default: () => ({ status: "not_due" }) },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
