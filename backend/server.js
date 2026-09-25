require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const initSockets = require("./sockets");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const matchRoutes = require("./routes/matches");
const exchangeRoutes = require("./routes/exchanges");
const paidListingRoutes = require("./routes/paidListings");
const bookingRoutes = require("./routes/bookings");
const paymentRoutes = require("./routes/payments");
const messageRoutes = require("./routes/messages");
const reviewRoutes = require("./routes/reviews");
const notificationRoutes = require("./routes/notifications");
const dashboardRoutes = require("./routes/dashboard");
const adminRoutes = require("./routes/admin");
const reportRoutes = require("./routes/reports");
const categoryRoutes = require("./routes/categories");

connectDB();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*" },
});
app.set("io", io); // make io accessible inside route handlers via req.app.get("io")
initSockets(io);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes); // US-01, US-02, US-40
app.use("/api/users", userRoutes); // US-03 to US-08
app.use("/api/matches", matchRoutes); // US-09
app.use("/api/exchanges", exchangeRoutes); // US-10 to US-15
app.use("/api/paid-listings", paidListingRoutes); // US-16 to US-24
app.use("/api/bookings", bookingRoutes); // US-18,19,20,21,25,26
app.use("/api/payments", paymentRoutes); // US-27, US-28
app.use("/api/messages", messageRoutes); // US-29, US-30
app.use("/api/reviews", reviewRoutes); // US-31 to US-34
app.use("/api/notifications", notificationRoutes); // US-35 to US-37
app.use("/api/dashboard", dashboardRoutes); // US-38, US-39
app.use("/api/admin", adminRoutes); // US-41 to US-45
app.use("/api/reports", reportRoutes);
app.use("/api/categories", categoryRoutes); // public: powers skill-add & search filter dropdowns

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`SkillSwap server running on port ${PORT}`));
