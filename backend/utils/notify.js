const Notification = require("../models/Notification");

// Creates a notification in DB and pushes it live via socket.io if the user is online
const notify = async (io, userId, { type, message, link }) => {
  const notification = await Notification.create({ user: userId, type, message, link });
  if (io) {
    io.to(`user_${userId}`).emit("notification", notification);
  }
  return notification;
};

module.exports = notify;
