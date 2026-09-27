const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// US-09: Get suitable skill matches
// Simple matching: find users who offer a skill I want, AND (bonus) want a skill I offer.
router.get("/", protect, async (req, res) => {
  const me = req.user;
  const wantedNames = me.wantedSkills.map((s) => s.skill.toLowerCase());
  const offeredNames = me.offeredSkills.map((s) => s.skill.toLowerCase());

  if (wantedNames.length === 0) {
    return res.json({ matches: [], message: "Add wanted skills to get matches" });
  }

  const candidates = await User.find({
    _id: { $ne: me._id },
    status: "active",
    "offeredSkills.skill": { $in: wantedNames.map((n) => new RegExp(`^${n}$`, "i")) },
  }).select("name avatar location bio age gender offeredSkills wantedSkills ratingAvg ratingCount");

  const matches = candidates.map((c) => {
    const theyOfferIWant = c.offeredSkills.filter((s) =>
      wantedNames.includes(s.skill.toLowerCase())
    );
    const theyWantIOffer = c.wantedSkills.filter((s) =>
      offeredNames.includes(s.skill.toLowerCase())
    );
    const isMutual = theyWantIOffer.length > 0;
    return {
      user: c,
      theyOfferIWant,
      theyWantIOffer,
      isMutual, // mutual matches (true skill swap) ranked higher
    };
  });

  matches.sort((a, b) => (b.isMutual === a.isMutual ? 0 : b.isMutual ? 1 : -1));

  res.json({ matches });
});

module.exports = router;
