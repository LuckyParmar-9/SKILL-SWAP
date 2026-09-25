const express = require("express");
const router = express.Router();
const PaidListing = require("../models/PaidListing");
const { protect, verifiedExpertOnly } = require("../middleware/auth");

// US-23/US-24: Provider creates a paid learning listing (details + price).
// Only accounts registered as "expert" AND admin-verified can create listings.
router.post("/", protect, verifiedExpertOnly, async (req, res) => {
  const { skill, category, description, price, duration } = req.body;
  if (!skill || !description || price === undefined) {
    return res.status(400).json({ message: "skill, description and price are required" });
  }
  const listing = await PaidListing.create({
    provider: req.user._id,
    skill,
    category,
    description,
    price,
    duration,
  });
  res.status(201).json(listing);
});

// US-22: Add available time slots to a listing
router.post("/:id/slots", protect, verifiedExpertOnly, async (req, res) => {
  const { date, startTime, endTime } = req.body;
  const listing = await PaidListing.findById(req.params.id);
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  if (String(listing.provider) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  listing.slots.push({ date, startTime, endTime });
  await listing.save();
  res.status(201).json(listing.slots);
});

// US-16: View paid providers for a required skill
router.get("/", async (req, res) => {
  const { skill } = req.query;
  const filter = { isActive: true };
  if (skill) filter.skill = { $regex: skill, $options: "i" };
  const listings = await PaidListing.find(filter)
    .populate("provider", "name avatar location ratingAvg ratingCount")
    .sort("-createdAt");
  res.json(listings);
});

// Provider's own listings
router.get("/mine", protect, async (req, res) => {
  const listings = await PaidListing.find({ provider: req.user._id }).sort("-createdAt");
  res.json(listings);
});

// US-17: View a specific listing's details and price
router.get("/:id", async (req, res) => {
  const listing = await PaidListing.findById(req.params.id).populate(
    "provider",
    "name avatar location bio ratingAvg ratingCount"
  );
  if (!listing) return res.status(404).json({ message: "Not found" });
  res.json(listing);
});

router.put("/:id", protect, async (req, res) => {
  const listing = await PaidListing.findById(req.params.id);
  if (!listing) return res.status(404).json({ message: "Not found" });
  if (String(listing.provider) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  const { skill, category, description, price, duration, isActive } = req.body;
  Object.assign(listing, {
    skill: skill ?? listing.skill,
    category: category ?? listing.category,
    description: description ?? listing.description,
    price: price ?? listing.price,
    duration: duration ?? listing.duration,
    isActive: isActive ?? listing.isActive,
  });
  await listing.save();
  res.json(listing);
});

module.exports = router;
