const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");
const notify = require("../utils/notify");
const isPaymentGateOpen = require("../utils/paymentGate");

const conversationId = (a, b) => [String(a), String(b)].sort().join("_");

// Get conversation history with another user
router.get("/:userId", protect, async (req, res) => {
  const convoId = conversationId(req.user._id, req.params.userId);
  const messages = await Message.find({ conversationId: convoId }).sort("createdAt");
  await Message.updateMany(
    { conversationId: convoId, receiver: req.user._id, read: false },
    { read: true }
  );
  res.json(messages);
});

// Whether this user can currently message/call the other user — lets the
// frontend show the locked/paid state upfront instead of only finding out
// after a send attempt fails. Returns { open: true } for any pair with no
// paid-listing booking between them at all (e.g. a free skill-swap match),
// so this never affects that flow.
router.get("/:userId/access", protect, async (req, res) => {
  const open = await isPaymentGateOpen(req.user._id, req.params.userId);
  res.json({ open });
});

// List all conversations (latest message per contact) for inbox view
router.get("/", protect, async (req, res) => {
  const messages = await Message.find({
    $or: [{ sender: req.user._id }, { receiver: req.user._id }],
  })
    .sort("-createdAt")
    .populate("sender", "name avatar")
    .populate("receiver", "name avatar");

  const seen = new Set();
  const conversations = [];
  for (const m of messages) {
    if (seen.has(m.conversationId)) continue;
    seen.add(m.conversationId);
    conversations.push(m);
  }
  res.json(conversations);
});

// US-29: Send message (fallback REST endpoint; primary path is via socket "sendMessage")
router.post("/:userId", protect, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "Content required" });

  // Blocks messaging between a learner and provider until the first payment
  // on their paid-listing booking has cleared. Has no effect on unrelated
  // free skill-swap conversations — see utils/paymentGate.js for the rule.
  const gateOpen = await isPaymentGateOpen(req.user._id, req.params.userId);
  if (!gateOpen) {
    return res.status(403).json({
      message: "You can message this user once your first payment for the booking is completed.",
    });
  }

  const convoId = conversationId(req.user._id, req.params.userId);
  const message = await Message.create({
    conversationId: convoId,
    sender: req.user._id,
    receiver: req.params.userId,
    content,
  });

  const io = req.app.get("io");
  io.to(`user_${req.params.userId}`).emit("receiveMessage", message); // US-30
  await notify(io, req.params.userId, {
    type: "message",
    message: `New message from ${req.user.name}`,
    link: `/messages/${req.user._id}`,
  });

  res.status(201).json(message);
});

module.exports = router;
