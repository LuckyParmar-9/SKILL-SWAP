const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

router.get("/", protect, async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort("-createdAt").limit(50);
  res.json(notifications);
});

router.put("/:id/read", protect, async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true },
    { new: true }
  );
  res.json(n);
});

router.put("/read-all", protect, async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: "All marked as read" });
});

module.exports = router;
