const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Category = require("../models/Category");
const Report = require("../models/Report");
const Booking = require("../models/Booking");
const { protect, adminOnly } = require("../middleware/auth");
const notify = require("../utils/notify");

router.use(protect, adminOnly); // US-40: only admins reach these routes

// Expert/Teacher verification queue: qualification, experience and optional
// certificate submitted at registration are reviewed here before an expert
// can publish paid listings.
router.get("/experts", async (req, res) => {
  const { status } = req.query; // optional filter: pending | verified | rejected
  const filter = { role: "expert" };
  if (status) filter["expertProfile.verificationStatus"] = status;
  const experts = await User.find(filter).select("-password").sort("-createdAt");
  res.json(experts);
});

router.put("/experts/:id/verify", async (req, res) => {
  const { decision, adminNote } = req.body; // decision: "verified" | "rejected"
  if (!["verified", "rejected"].includes(decision)) {
    return res.status(400).json({ message: "decision must be 'verified' or 'rejected'" });
  }
  const expert = await User.findById(req.params.id);
  if (!expert || expert.role !== "expert") {
    return res.status(404).json({ message: "Expert account not found" });
  }
  expert.expertProfile.verificationStatus = decision;
  expert.expertProfile.adminNote = adminNote || "";
  expert.expertProfile.verifiedAt = decision === "verified" ? new Date() : null;
  await expert.save();

  await notify(req.app.get("io"), expert._id, {
    type: "expert_verification",
    message:
      decision === "verified"
        ? "Your expert account has been verified! You can now create paid learning listings."
        : `Your expert verification was rejected${adminNote ? `: ${adminNote}` : "."}`,
    link: "/my-paid-listings",
  });

  res.json(expert);
});

// US-41: View and manage users
router.get("/users", async (req, res) => {
  const users = await User.find().select("-password").sort("-createdAt");
  res.json(users);
});

// US-44: Suspend or block a user
router.put("/users/:id/status", async (req, res) => {
  const { status } = req.body; // "active" | "suspended" | "blocked"
  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select("-password");
  if (!user) return res.status(404).json({ message: "Not found" });
  res.json(user);
});

// US-42: Manage skill categories (and their sub-categories)
router.get("/categories", async (req, res) => {
  const categories = await Category.find().sort("name");
  res.json(categories);
});
router.post("/categories", async (req, res) => {
  const { name, description, subCategories } = req.body;
  const category = await Category.create({
    name,
    description,
    subCategories: Array.isArray(subCategories)
      ? subCategories
      : (subCategories || "").split(",").map((s) => s.trim()).filter(Boolean),
  });
  res.status(201).json(category);
});
router.put("/categories/:id", async (req, res) => {
  const body = { ...req.body };
  if (typeof body.subCategories === "string") {
    body.subCategories = body.subCategories.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const category = await Category.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json(category);
});
router.delete("/categories/:id", async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ message: "Category deleted" });
});

// US-43: View and manage reports/complaints
router.get("/reports", async (req, res) => {
  const reports = await Report.find()
    .populate("reportedBy", "name email")
    .populate("reportedUser", "name email")
    .sort("-createdAt");
  res.json(reports);
});
router.put("/reports/:id", async (req, res) => {
  const { status } = req.body;
  const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(report);
});

// US-45: Monitor paid-learning bookings and transactions
router.get("/bookings", async (req, res) => {
  const bookings = await Booking.find()
    .populate("learner", "name email")
    .populate("provider", "name email")
    .populate("listing", "skill price")
    .sort("-createdAt");
  res.json(bookings);
});

module.exports = router;
