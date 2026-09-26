const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");

const conversationId = (a, b) => [String(a), String(b)].sort().join("_");

// In-memory map of userId -> partnerUserId for users currently on a call, so we
// can notify the other side if someone disconnects mid-call (tab closed, etc).
// This is signaling-only bookkeeping; the actual audio/video never touches the
// server — it flows peer-to-peer between the two browsers via WebRTC.
const activeCalls = new Map();

const initSockets = (io) => {
  // Authenticate socket connection using JWT sent in handshake auth
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user_${socket.userId}`);
    console.log(`Socket connected: user_${socket.userId}`);

    // US-29: send message; US-30: receive message (delivered to receiver's room)
    socket.on("sendMessage", async ({ receiverId, content }) => {
      if (!receiverId || !content) return;
      const convoId = conversationId(socket.userId, receiverId);
      const message = await Message.create({
        conversationId: convoId,
        sender: socket.userId,
        receiver: receiverId,
        content,
      });

      // Include the sender's display name so the receiver's global "new message"
      // toast (shown on any page, not just the Messages screen) can show who it's from.
      const senderUser = await User.findById(socket.userId).select("name");
      const payload = { ...message.toObject(), senderName: senderUser?.name || "Someone" };

      io.to(`user_${receiverId}`).emit("receiveMessage", payload);
      socket.emit("messageSent", payload);

      const notification = await Notification.create({
        user: receiverId,
        type: "message",
        message: "You have a new message",
        link: `/messages/${socket.userId}`,
      });
      io.to(`user_${receiverId}`).emit("notification", notification);
    });

    socket.on("typing", ({ receiverId }) => {
      io.to(`user_${receiverId}`).emit("typing", { from: socket.userId });
    });

    // --- Voice/video call signaling (ring / accept / reject only) --------
    // The actual audio/video connection is Daily.co's job now (see routes/calls.js
    // and CallModal.jsx) — the server here only relays "someone is calling you"
    // and the Daily room URL to join, never any call media itself.

    // Caller -> callee: "someone is calling you, here's the room to join"
    socket.on("call:invite", ({ toUserId, callType, fromName, roomUrl }) => {
      io.to(`user_${toUserId}`).emit("call:incoming", {
        fromUserId: socket.userId,
        fromName,
        callType, // "audio" | "video"
        roomUrl,
      });
    });

    // Caller cancels before the callee answers
    socket.on("call:cancel", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:cancelled", { fromUserId: socket.userId });
    });

    // Callee accepts -> tell the caller to join the Daily room too
    socket.on("call:accept", ({ toUserId }) => {
      activeCalls.set(socket.userId, toUserId);
      activeCalls.set(toUserId, socket.userId);
      io.to(`user_${toUserId}`).emit("call:accepted", { fromUserId: socket.userId });
    });

    // Callee declines
    socket.on("call:reject", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:rejected", { fromUserId: socket.userId });
    });

    // Either side hangs up (or clicks Daily's own "Leave" button)
    socket.on("call:end", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:ended", { fromUserId: socket.userId });
      activeCalls.delete(socket.userId);
      activeCalls.delete(toUserId);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user_${socket.userId}`);
      // If this user dropped mid-call (closed tab, lost connection), tell their
      // partner so the partner's UI doesn't hang waiting for a call that's over.
      const partnerId = activeCalls.get(socket.userId);
      if (partnerId) {
        io.to(`user_${partnerId}`).emit("call:ended", { fromUserId: socket.userId });
        activeCalls.delete(partnerId);
      }
      activeCalls.delete(socket.userId);
    });
  });
};

module.exports = initSockets;
