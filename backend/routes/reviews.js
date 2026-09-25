const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const recalcRating = async (providerId) => {
  const reviews = await Review.find({ provider: providerId });
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  await User.findByIdAndUpdate(providerId, { ratingAvg: avg.toFixed(2), ratingCount: count });
};

// US-31/US-32: Rate & review a skill provider (paid learning); US-33: rate a skill exchange
router.post("/", protect, async (req, res) => {
  const { providerId, type, refId, rating, comment } = req.body;
  if (!providerId || !type || !refId || !rating) {
    return res.status(400).json({ message: "providerId, type, refId, rating are required" });
  }
  const review = await Review.create({
    reviewer: req.user._id,
    provider: providerId,
    type,
    refId,
    rating,
    comment,
  });
  await recalcRating(providerId);
  res.status(201).json(review);
});

// US-34: View ratings/reviews of a provider
router.get("/provider/:providerId", async (req, res) => {
  const reviews = await Review.find({ provider: req.params.providerId })
    .populate("reviewer", "name avatar")
    .sort("-createdAt");
  res.json(reviews);
});

module.exports = router;
