const express = require("express");
const router = express.Router();
const Exchange = require("../models/Exchange");
const { protect } = require("../middleware/auth");
const notify = require("../utils/notify");

// US-10: Send exchange request
router.post("/", protect, async (req, res) => {
  const { receiverId, requesterSkill, receiverSkill, message } = req.body;
  if (!receiverId || !requesterSkill || !receiverSkill) {
    return res.status(400).json({ message: "receiverId, requesterSkill, receiverSkill required" });
  }
  const exchange = await Exchange.create({
    requester: req.user._id,
    receiver: receiverId,
    requesterSkill,
    receiverSkill,
    message: message || "",
  });
  await notify(req.app.get("io"), receiverId, {
    type: "exchange_request",
    message: `${req.user.name} sent you a skill exchange request`,
    link: `/exchanges/${exchange._id}`,
  });
  res.status(201).json(exchange);
});

// List my exchanges (all statuses) - also backs US-13, US-39
router.get("/", protect, async (req, res) => {
  const exchanges = await Exchange.find({
    $or: [{ requester: req.user._id }, { receiver: req.user._id }],
  })
    .populate("requester", "name avatar")
    .populate("receiver", "name avatar")
    .sort("-createdAt");
  res.json(exchanges);
});

router.get("/:id", protect, async (req, res) => {
  const exchange = await Exchange.findById(req.params.id)
    .populate("requester", "name avatar email")
    .populate("receiver", "name avatar email");
  if (!exchange) return res.status(404).json({ message: "Not found" });
  res.json(exchange);
});

// US-11: Accept
router.put("/:id/accept", protect, async (req, res) => {
  const exchange = await Exchange.findById(req.params.id);
  if (!exchange) return res.status(404).json({ message: "Not found" });
  if (String(exchange.receiver) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  exchange.status = "active";
  await exchange.save();
  await notify(req.app.get("io"), exchange.requester, {
    type: "exchange_update",
    message: `${req.user.name} accepted your exchange request`,
    link: `/exchanges/${exchange._id}`,
  });
  res.json(exchange);
});

// US-12: Reject
router.put("/:id/reject", protect, async (req, res) => {
  const exchange = await Exchange.findById(req.params.id);
  if (!exchange) return res.status(404).json({ message: "Not found" });
  if (String(exchange.receiver) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  exchange.status = "rejected";
  await exchange.save();
  await notify(req.app.get("io"), exchange.requester, {
    type: "exchange_update",
    message: `${req.user.name} rejected your exchange request`,
    link: `/exchanges/${exchange._id}`,
  });
  res.json(exchange);
});

// US-14: Complete
router.put("/:id/complete", protect, async (req, res) => {
  const exchange = await Exchange.findById(req.params.id);
  if (!exchange) return res.status(404).json({ message: "Not found" });
  const isParty = [String(exchange.requester), String(exchange.receiver)].includes(String(req.user._id));
  if (!isParty) return res.status(403).json({ message: "Not authorized" });
  exchange.status = "completed";
  await exchange.save();
  res.json(exchange);
});

// US-15: Cancel
router.put("/:id/cancel", protect, async (req, res) => {
  const exchange = await Exchange.findById(req.params.id);
  if (!exchange) return res.status(404).json({ message: "Not found" });
  const isParty = [String(exchange.requester), String(exchange.receiver)].includes(String(req.user._id));
  if (!isParty) return res.status(403).json({ message: "Not authorized" });
  exchange.status = "cancelled";
  await exchange.save();
  res.json(exchange);
});

module.exports = router;
