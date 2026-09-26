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
const callRoutes = require("./routes/calls");

connectDB();

// CLIENT_URL can be a single origin, a comma-separated list, and/or contain "*"
// wildcards — e.g. "https://skillswap-one-rust.vercel.app,https://*.vercel.app"
// so per-deployment preview URLs (which Vercel/Netlify generate fresh on every
// commit) don't need a manual env var update each time. Leave CLIENT_URL unset
// to allow any origin (fine for local dev; set it explicitly in production).
const rawOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const originMatchers = rawOrigins.map((entry) =>
  entry.includes("*")
    ? new RegExp("^" + entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$")
    : entry
);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // non-browser clients (curl, server-to-server, mobile apps)
  if (originMatchers.length === 0) return true; // CLIENT_URL not set — allow all (dev default)
  return originMatchers.some((m) => (m instanceof RegExp ? m.test(origin) : m === origin));
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.warn(`CORS blocked request from origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });
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
app.use("/api/calls", callRoutes); // creates Daily.co rooms for voice/video calls

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`SkillSwap server running on port ${PORT}`));
