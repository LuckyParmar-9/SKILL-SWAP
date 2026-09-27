const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const PaidListing = require("../models/PaidListing");
const { protect } = require("../middleware/auth");
const notify = require("../utils/notify");

// US-19: Learner requests a paid learning session. No slot is picked here
// anymore — the learner just requests the listing itself. The actual date/
// time gets set later by the provider, once the request is accepted AND the
// first payment has cleared (see PUT /:id/schedule below).
router.post("/", protect, async (req, res) => {
  const { listingId } = req.body;
  const listing = await PaidListing.findById(listingId);
  if (!listing || !listing.isActive) return res.status(404).json({ message: "Listing not found" });

  const booking = await Booking.create({
    learner: req.user._id,
    provider: listing.provider,
    listing: listing._id,
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
    .populate("scheduleProposal.proposedBy", "name")
    .sort("-createdAt");
  res.json(bookings);
});

// Learner views their own bookings - also backs US-39
router.get("/mine", protect, async (req, res) => {
  const bookings = await Booking.find({ learner: req.user._id })
    .populate("provider", "name avatar")
    .populate("listing", "skill price")
    .populate("scheduleProposal.proposedBy", "name")
    .sort("-createdAt");
  res.json(bookings);
});

router.get("/:id", protect, async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("provider", "name avatar")
    .populate("learner", "name avatar")
    .populate("listing")
    .populate("scheduleProposal.proposedBy", "name");
  if (!booking) return res.status(404).json({ message: "Not found" });
  res.json(booking);
});

// US-21: Provider accepts/rejects a learning request. No slot to reserve
// here anymore — that only gets picked once payment has cleared.
router.put("/:id/respond", protect, async (req, res) => {
  const { action } = req.body; // "accept" | "reject"
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Not found" });
  if (String(booking.provider) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  booking.status = action === "accept" ? "accepted" : "rejected";
  await booking.save();

  await notify(req.app.get("io"), booking.learner, {
    type: "booking",
    message: `Your learning request was ${booking.status}`,
    link: `/my-learning`,
  });
  res.json(booking);
});

// Either the learner or the provider can suggest a session date/time. Only
// allowed once the booking is accepted AND the first payment has cleared.
// Suggesting a new time always overwrites whatever proposal existed before —
// this doubles as how someone "counter-suggests" a different time.
router.put("/:id/propose-schedule", protect, async (req, res) => {
  const { date, startTime, endTime } = req.body;
  if (!date || !startTime || !endTime) {
    return res.status(400).json({ message: "date, startTime and endTime are required" });
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Not found" });
  const isParty = [String(booking.learner), String(booking.provider)].includes(String(req.user._id));
  if (!isParty) return res.status(403).json({ message: "Not authorized" });
  if (booking.payment.first.status !== "paid") {
    return res.status(400).json({ message: "The first payment must clear before scheduling a time" });
  }

  booking.scheduleProposal = {
    date,
    startTime,
    endTime,
    proposedBy: req.user._id,
    status: "pending",
  };
  await booking.save();

  const otherPartyId =
    String(booking.learner) === String(req.user._id) ? booking.provider : booking.learner;
  await notify(req.app.get("io"), otherPartyId, {
    type: "booking",
    message: `${req.user.name} suggested a session time: ${date} at ${startTime}-${endTime}`,
    link: `/exchanges`,
  });

  res.json(booking);
});

// The OTHER party (never the one who proposed it) accepts or declines the
// current pending suggestion. Accepting copies it into the real `slot`.
router.put("/:id/respond-schedule", protect, async (req, res) => {
  const { action } = req.body; // "accept" | "reject"
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Not found" });
  const isParty = [String(booking.learner), String(booking.provider)].includes(String(req.user._id));
  if (!isParty) return res.status(403).json({ message: "Not authorized" });

  const proposal = booking.scheduleProposal;
  if (!proposal || proposal.status !== "pending") {
    return res.status(400).json({ message: "There's no pending time suggestion to respond to" });
  }
  if (String(proposal.proposedBy) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't accept or reject your own suggestion" });
  }

  if (action === "accept") {
    booking.slot = { date: proposal.date, startTime: proposal.startTime, endTime: proposal.endTime };
    booking.scheduleProposal.status = "accepted";
  } else {
    booking.scheduleProposal.status = "rejected";
  }
  await booking.save();

  await notify(req.app.get("io"), proposal.proposedBy, {
    type: "booking",
    message:
      action === "accept"
        ? `Your suggested session time (${proposal.date} ${proposal.startTime}-${proposal.endTime}) was accepted.`
        : `Your suggested session time was declined. Try suggesting another one.`,
    link: `/exchanges`,
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
