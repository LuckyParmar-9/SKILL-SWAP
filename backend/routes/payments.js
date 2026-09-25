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

// US-27 (step 1): Create a Razorpay order for a booking
router.post("/create-order", protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (String(booking.learner) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (booking.status !== "accepted") {
      return res.status(400).json({ message: "Booking must be accepted by provider before payment" });
    }

    const options = {
      amount: Math.round(booking.price * 100), // paise
      currency: "INR",
      receipt: `booking_${booking._id}`,
    };
    const order = await razorpay.orders.create(options);

    booking.payment.orderId = order.id;
    await booking.save();

    res.json({
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

// US-27 (step 2) / US-28: Verify payment signature and confirm booking
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (generatedSignature !== razorpay_signature) {
      booking.payment.status = "failed";
      await booking.save();
      return res.status(400).json({ verified: false, message: "Payment verification failed" });
    }

    booking.payment.status = "paid";
    booking.payment.paymentId = razorpay_payment_id;
    booking.status = "confirmed";
    await booking.save();

    await notify(req.app.get("io"), booking.provider, {
      type: "payment",
      message: `Payment received for booking on ${booking.slot.date}`,
      link: `/provider/requests`,
    });
    await notify(req.app.get("io"), booking.learner, {
      type: "payment",
      message: `Payment successful. Your session is confirmed!`,
      link: `/my-learning`,
    });

    res.json({ verified: true, booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
