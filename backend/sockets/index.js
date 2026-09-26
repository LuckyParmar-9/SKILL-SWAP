const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");

const conversationId = (a, b) => [String(a), String(b)].sort().join("_");

// In-memory map of userId -> partnerUserId for users currently on a call, so we
// can notify the other side if someone disconnects mid-call (tab closed, etc).
// This is signaling-only bookkeeping; the actual audio/video is now raw
// peer-to-peer WebRTC — it never touches this server at all. The server's
// only job is relaying the ring/accept/reject messages, plus the WebRTC
// "handshake" messages (offer/answer/ICE candidates) needed to set up that
// direct connection.
const activeCalls = new Map();

const initSockets = (io) => {
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

    socket.on("sendMessage", async ({ receiverId, content }) => {
      if (!receiverId || !content) return;
      const convoId = conversationId(socket.userId, receiverId);
      const message = await Message.create({
        conversationId: convoId,
        sender: socket.userId,
        receiver: receiverId,
        content,
      });

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

    // --- Call ring / accept / reject signaling ---------------------------
    socket.on("call:invite", ({ toUserId, callType, fromName }) => {
      io.to(`user_${toUserId}`).emit("call:incoming", {
        fromUserId: socket.userId,
        fromName,
        callType, // "audio" | "video"
      });
    });

    socket.on("call:cancel", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:cancelled", { fromUserId: socket.userId });
    });

    socket.on("call:accept", ({ toUserId }) => {
      activeCalls.set(socket.userId, toUserId);
      activeCalls.set(toUserId, socket.userId);
      io.to(`user_${toUserId}`).emit("call:accepted", { fromUserId: socket.userId });
    });

    socket.on("call:reject", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:rejected", { fromUserId: socket.userId });
    });

    socket.on("call:end", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:ended", { fromUserId: socket.userId });
      activeCalls.delete(socket.userId);
      activeCalls.delete(toUserId);
    });

    // --- Raw WebRTC handshake relay ---------------------------------------
    // The server just forwards these blind — it never inspects or stores
    // them. This is the "signaling channel" every WebRTC app needs; the
    // actual audio/video never flows through here.
    socket.on("webrtc:offer", ({ toUserId, sdp }) => {
      io.to(`user_${toUserId}`).emit("webrtc:offer", { fromUserId: socket.userId, sdp });
    });

    socket.on("webrtc:answer", ({ toUserId, sdp }) => {
      io.to(`user_${toUserId}`).emit("webrtc:answer", { fromUserId: socket.userId, sdp });
    });

    socket.on("webrtc:ice-candidate", ({ toUserId, candidate }) => {
      io.to(`user_${toUserId}`).emit("webrtc:ice-candidate", { fromUserId: socket.userId, candidate });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user_${socket.userId}`);
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
