const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const PaidListing = require("../models/PaidListing");
const { protect } = require("../middleware/auth");
const notify = require("../utils/notify");

// US-19: Learner requests a paid learning session (US-18 select provider happens on frontend)
router.post("/", protect, async (req, res) => {
  const { listingId, slotId } = req.body;
  const listing = await PaidListing.findById(listingId);
  if (!listing || !listing.isActive) return res.status(404).json({ message: "Listing not found" });

  const slot = listing.slots.id(slotId);
  if (!slot || slot.isBooked) return res.status(400).json({ message: "Slot not available" }); // supports US-25

  const booking = await Booking.create({
    learner: req.user._id,
    provider: listing.provider,
    listing: listing._id,
    slot: { date: slot.date, startTime: slot.startTime, endTime: slot.endTime },
    price: listing.price,
  });

  await notify(req.app.get("io"), listing.provider, {
    type: "learning_request",
    message: `${req.user.name} requested to learn "${listing.skill}"`,
    link: `/provider/requests`,
  });

  res.status(201).json(booking);
});

// US-20: Provider views incoming paid learning requests
router.get("/incoming", protect, async (req, res) => {
  const bookings = await Booking.find({ provider: req.user._id })
    .populate("learner", "name avatar")
    .populate("listing", "skill price")
    .sort("-createdAt");
  res.json(bookings);
});

// Learner views their own bookings - also backs US-39
router.get("/mine", protect, async (req, res) => {
  const bookings = await Booking.find({ learner: req.user._id })
    .populate("provider", "name avatar")
    .populate("listing", "skill price")
    .sort("-createdAt");
  res.json(bookings);
});

router.get("/:id", protect, async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("provider", "name avatar")
    .populate("learner", "name avatar")
    .populate("listing");
  if (!booking) return res.status(404).json({ message: "Not found" });
  res.json(booking);
});

// US-21: Provider accepts/rejects a learning request
router.put("/:id/respond", protect, async (req, res) => {
  const { action } = req.body; // "accept" | "reject"
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Not found" });
  if (String(booking.provider) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  booking.status = action === "accept" ? "accepted" : "rejected";

  if (action === "accept") {
    const listing = await PaidListing.findById(booking.listing);
    const slot = listing.slots.find(
      (s) => s.date === booking.slot.date && s.startTime === booking.slot.startTime
    );
    if (slot) {
      slot.isBooked = true;
      await listing.save();
    }
  }

  await booking.save();
  await notify(req.app.get("io"), booking.learner, {
    type: "booking",
    message: `Your learning request was ${booking.status}`,
    link: `/my-learning`,
  });
  res.json(booking);
});

// US-15 equivalent for paid bookings: cancel
router.put("/:id/cancel", protect, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Not found" });
  const isParty = [String(booking.learner), String(booking.provider)].includes(String(req.user._id));
  if (!isParty) return res.status(403).json({ message: "Not authorized" });
  booking.status = "cancelled";
  await booking.save();
  res.json(booking);
});

// Mark completed. Either party can still mark a booking completed as before
// (e.g. for review-eligibility bookkeeping elsewhere in the app). What's new:
// when the PROVIDER SPECIFICALLY marks a split-payment booking completed —
// and only then — the final payment becomes payable. A learner marking their
// own booking "completed" can never unlock the final payment themselves.
router.put("/:id/complete", protect, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Not found" });
  const isParty = [String(booking.learner), String(booking.provider)].includes(String(req.user._id));
  if (!isParty) return res.status(403).json({ message: "Not authorized" });

  const isProvider = String(booking.provider) === String(req.user._id);
  const unlockingFinalPayment =
    isProvider &&
    booking.payment.plan === "split" &&
    booking.payment.first.status === "paid" &&
    booking.payment.second.status === "not_due";

  booking.status = "completed";
  if (unlockingFinalPayment) {
    booking.payment.second.status = "due";
  }
  await booking.save();

  if (unlockingFinalPayment) {
    await notify(req.app.get("io"), booking.learner, {
      type: "payment",
      message: `Session marked complete — your final payment of ₹${booking.payment.second.amount} is now due.`,
      link: `/my-learning`,
    });
  }

  res.json(booking);
});

module.exports = router;
