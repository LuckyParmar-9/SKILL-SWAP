const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Review = require("../models/Review");
const { protect } = require("../middleware/auth");

// US-03: Create/Update profile (name, age, gender, email, bio, location, avatar)
router.put("/profile", protect, async (req, res) => {
  const { name, age, gender, email, bio, location, avatar } = req.body;
  const user = req.user;

  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: "Email is already in use by another account" });
    user.email = email.toLowerCase();
  }

  if (name) user.name = name;
  if (age !== undefined) user.age = age === "" ? null : age;
  if (gender !== undefined) user.gender = gender;
  if (bio !== undefined) user.bio = bio;
  if (location !== undefined) user.location = location;
  if (avatar !== undefined) user.avatar = avatar;
  await user.save();
  res.json(user);
});

// US-04: Add offered skill (category, sub-category, level, mode, language)
router.post("/skills/offered", protect, async (req, res) => {
  const { skill, category, subCategory, level, mode, language, description } = req.body;
  if (!skill) return res.status(400).json({ message: "Skill name is required" });
  req.user.offeredSkills.push({ skill, category, subCategory, level, mode, language, description });
  await req.user.save();
  res.status(201).json(req.user.offeredSkills);
});

// US-05: Add wanted skill (category, sub-category, level, mode, language)
router.post("/skills/wanted", protect, async (req, res) => {
  const { skill, category, subCategory, level, mode, language } = req.body;
  if (!skill) return res.status(400).json({ message: "Skill name is required" });
  req.user.wantedSkills.push({ skill, category, subCategory, level, mode, language });
  await req.user.save();
  res.status(201).json(req.user.wantedSkills);
});

// US-06: Update skill level (offered or wanted)
router.put("/skills/:listType/:skillId/level", protect, async (req, res) => {
  const { listType, skillId } = req.params; // listType: "offered" | "wanted"
  const { level } = req.body;
  const list = listType === "offered" ? req.user.offeredSkills : req.user.wantedSkills;
  const entry = list.id(skillId);
  if (!entry) return res.status(404).json({ message: "Skill not found" });
  entry.level = level;
  await req.user.save();
  res.json(entry);
});

// Delete a skill entry
router.delete("/skills/:listType/:skillId", protect, async (req, res) => {
  const { listType, skillId } = req.params;
  const list = listType === "offered" ? req.user.offeredSkills : req.user.wantedSkills;
  list.id(skillId)?.deleteOne();
  await req.user.save();
  res.json({ message: "Removed" });
});

// US-07: Search for skill, with optional category/sub-category/mode/language filters.
// At least one of q/category/subCategory/mode/language must be given.
router.get("/search", protect, async (req, res) => {
  const { q, category, subCategory, mode, language } = req.query;
  if (!q && !category && !subCategory && !mode && !language) return res.json([]);

  // Build a single $elemMatch so all filters apply to the SAME offered-skill entry
  // (e.g. "Guitar" taught "Offline" in "Hindi" — not any skill matching any filter separately).
  const elemMatch = {};
  if (q) elemMatch.skill = { $regex: q, $options: "i" };
  if (category) elemMatch.category = category;
  if (subCategory) elemMatch.subCategory = subCategory;
  if (mode) elemMatch.mode = mode;
  if (language) elemMatch.language = language;

  const users = await User.find({
    status: "active",
    offeredSkills: { $elemMatch: elemMatch },
  }).select("name avatar location bio offeredSkills ratingAvg ratingCount");
  res.json(users);
});

// US-08: View a skill provider's profile
router.get("/:id", protect, async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  const reviews = await Review.find({ provider: user._id })
    .populate("reviewer", "name avatar")
    .sort("-createdAt");
  res.json({ user, reviews }); // also supports US-34
});

module.exports = router;
