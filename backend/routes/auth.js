const express = require("express");
const router = express.Router();
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { protect } = require("../middleware/auth");

// US-01: Register Account
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const user = await User.create({ name, email, password });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Expert/Teacher registration: a distinct flow from regular US-01 registration.
// Requires qualification and experience; certificate is optional. The account
// starts locked to "pending" verification until an admin approves it — see
// PUT /api/admin/experts/:id/verify and the verifiedExpertOnly middleware.
router.post("/register-expert", async (req, res) => {
  try {
    const { name, email, password, qualification, experience, certificateUrl } = req.body;
    if (!name || !email || !password || !qualification || !experience) {
      return res.status(400).json({
        message: "Name, email, password, qualification and experience are required",
      });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const user = await User.create({
      name,
      email,
      password,
      role: "expert",
      expertProfile: {
        qualification,
        experience,
        certificateUrl: certificateUrl || "",
        verificationStatus: "pending",
      },
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      expertProfile: user.expertProfile,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// US-02: Login (also serves US-40 admin login when role === admin, and expert login
// when role === "expert" — same credentials flow, but expert-only actions are
// gated separately by verification status once logged in)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.status !== "active") {
      return res.status(403).json({ message: `Account is ${user.status}` });
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current logged-in user
router.get("/me", protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
