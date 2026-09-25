const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

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

      io.to(`user_${receiverId}`).emit("receiveMessage", message);
      socket.emit("messageSent", message);

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

    // --- WebRTC voice/video call signaling -------------------------------
    // The server only relays these small JSON messages between the two
    // participants' rooms; it never sees or touches the actual call media.

    // Caller -> callee: "someone is calling you"
    socket.on("call:invite", ({ toUserId, callType, fromName }) => {
      io.to(`user_${toUserId}`).emit("call:incoming", {
        fromUserId: socket.userId,
        fromName,
        callType, // "audio" | "video"
      });
    });

    // Caller cancels before the callee answers
    socket.on("call:cancel", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:cancelled", { fromUserId: socket.userId });
    });

    // Callee accepts -> tell the caller to start the WebRTC offer/answer exchange
    socket.on("call:accept", ({ toUserId }) => {
      activeCalls.set(socket.userId, toUserId);
      activeCalls.set(toUserId, socket.userId);
      io.to(`user_${toUserId}`).emit("call:accepted", { fromUserId: socket.userId });
    });

    // Callee declines
    socket.on("call:reject", ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit("call:rejected", { fromUserId: socket.userId });
    });

    // WebRTC SDP offer/answer and ICE candidate relay
    socket.on("call:offer", ({ toUserId, sdp }) => {
      io.to(`user_${toUserId}`).emit("call:offer", { fromUserId: socket.userId, sdp });
    });
    socket.on("call:answer", ({ toUserId, sdp }) => {
      io.to(`user_${toUserId}`).emit("call:answer", { fromUserId: socket.userId, sdp });
    });
    socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
      io.to(`user_${toUserId}`).emit("call:ice-candidate", { fromUserId: socket.userId, candidate });
    });

    // Either side hangs up
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
