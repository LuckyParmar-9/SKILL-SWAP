const express = require("express");
const router = express.Router();
const Exchange = require("../models/Exchange");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

// US-38: Aggregated dashboard data; US-39: exchanges + paid learning activity
router.get("/", protect, async (req, res) => {
  const userId = req.user._id;

  const [exchanges, learningAsLearner, learningAsProvider, unreadNotifications] = await Promise.all([
    Exchange.find({ $or: [{ requester: userId }, { receiver: userId }] })
      .populate("requester", "name avatar")
      .populate("receiver", "name avatar")
      .sort("-createdAt")
      .limit(10),
    Booking.find({ learner: userId }).populate("provider", "name avatar").populate("listing", "skill").sort("-createdAt").limit(10),
    Booking.find({ provider: userId }).populate("learner", "name avatar").populate("listing", "skill").sort("-createdAt").limit(10),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);

  res.json({
    profile: {
      offeredSkills: req.user.offeredSkills,
      wantedSkills: req.user.wantedSkills,
      ratingAvg: req.user.ratingAvg,
      ratingCount: req.user.ratingCount,
    },
    exchanges,
    learningAsLearner,
    learningAsProvider,
    unreadNotifications,
  });
});

module.exports = router;
