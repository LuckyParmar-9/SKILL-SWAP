const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const { protect } = require("../middleware/auth");

// Any user can file a report/complaint about another user
router.post("/", protect, async (req, res) => {
  const { reportedUserId, reason, description } = req.body;
  if (!reportedUserId || !reason) {
    return res.status(400).json({ message: "reportedUserId and reason are required" });
  }
  const report = await Report.create({
    reportedBy: req.user._id,
    reportedUser: reportedUserId,
    reason,
    description,
  });
  res.status(201).json(report);
});

module.exports = router;
