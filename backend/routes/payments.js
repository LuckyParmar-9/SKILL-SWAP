const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Booking = require("../models/Booking");
const { protect } = require("../middleware/auth");
const notify = require("../utils/notify");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Creates a Razorpay order for whichever payment "leg" is currently owed on
// this booking. The frontend doesn't need to know which leg it is in
// advance — this endpoint figures it out from the booking's own state:
//
//   - First payment not yet paid  -> this call is for the FIRST payment.
//       Body must include { plan: "full" | "split", splitPercent } (splitPercent
//       required only when plan === "split"). The learner picks this here,
//       once — it's then locked in for the rest of the booking.
//   - First payment paid, plan is "split", second payment is "due"
//     (the provider has marked the session completed) -> this call is for
//     the FINAL payment. Body's plan/splitPercent are ignored.
//   - Anything else (already fully paid, or final payment not due yet) -> 400.
router.post("/create-order", protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (String(booking.learner) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (booking.status !== "accepted" && booking.status !== "confirmed" && booking.status !== "completed") {
      return res.status(400).json({ message: "Booking must be accepted by the provider before payment" });
    }

    let leg; // "first" | "second"

    if (booking.payment.first.status !== "paid") {
      leg = "first";

      const { plan, splitPercent } = req.body;
      if (!["full", "split"].includes(plan)) {
        return res.status(400).json({ message: "plan must be 'full' or 'split'" });
      }
      if (plan === "split") {
        const pct = Number(splitPercent);
        if (!pct || pct <= 0 || pct >= 100) {
          return res.status(400).json({ message: "splitPercent must be a number between 1 and 99" });
        }
        booking.payment.splitPercent = pct;
        booking.payment.first.amount = Math.round(booking.price * (pct / 100));
        booking.payment.second.amount = booking.price - booking.payment.first.amount;
        booking.payment.second.status = "not_due"; // unlocked later when provider marks session complete
      } else {
        booking.payment.first.amount = booking.price;
        booking.payment.second.amount = 0;
      }
      booking.payment.plan = plan;
    } else if (booking.payment.plan === "split" && booking.payment.second.status === "due") {
      leg = "second";
    } else if (booking.payment.plan === "split" && booking.payment.second.status === "not_due") {
      return res.status(400).json({
        message: "The final payment isn't available yet — it opens once the provider marks the session as completed.",
      });
    } else {
      return res.status(400).json({ message: "This booking is already fully paid" });
    }

    const amount = booking.payment[leg].amount;
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `booking_${booking._id}_${leg}`,
    });

    booking.payment[leg].orderId = order.id;
    await booking.save();

    res.json({
      leg,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingId: booking._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verifies Razorpay's signature and marks whichever leg this order belongs
// to as paid. Never trust the frontend's word that a payment succeeded —
// this signature check is the actual source of truth.
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    let leg;
    if (booking.payment.first.orderId === razorpay_order_id) leg = "first";
    else if (booking.payment.second.orderId === razorpay_order_id) leg = "second";
    else return res.status(400).json({ message: "This order does not belong to this booking" });

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      booking.payment[leg].status = "failed";
      await booking.save();
      return res.status(400).json({ verified: false, message: "Payment verification failed" });
    }

    booking.payment[leg].status = "paid";
    booking.payment[leg].paymentId = razorpay_payment_id;
    if (leg === "first") {
      booking.status = "confirmed"; // this is also what opens messaging/calling — see utils/paymentGate.js
    }
    await booking.save();

    const messageForProvider =
      leg === "first"
        ? `First payment received for booking on ${booking.slot.date}. You can now message/call the learner.`
        : `Final payment received for booking on ${booking.slot.date}.`;
    const messageForLearner =
      leg === "first"
        ? `Payment successful! You can now message/call the provider.`
        : `Final payment successful — session fully paid.`;

    await notify(req.app.get("io"), booking.provider, {
      type: "payment",
      message: messageForProvider,
      link: `/provider/requests`,
    });
    await notify(req.app.get("io"), booking.learner, {
      type: "payment",
      message: messageForLearner,
      link: `/my-learning`,
    });

    res.json({ verified: true, leg, booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
