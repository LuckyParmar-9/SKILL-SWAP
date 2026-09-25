const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) return res.status(401).json({ message: "User not found" });
      if (req.user.status !== "active") {
        return res.status(403).json({ message: `Account is ${req.user.status}` });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }
  }
  return res.status(401).json({ message: "Not authorized, no token" });
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Admin access required" });
};

// Only accounts registered through the expert/teacher sign-up flow
const expertOnly = (req, res, next) => {
  if (req.user && req.user.role === "expert") return next();
  return res.status(403).json({ message: "This action requires a verified expert/teacher account" });
};

// Expert accounts must additionally be approved by an admin before they can
// publish paid listings (US: expert verification gate)
const verifiedExpertOnly = (req, res, next) => {
  if (req.user && req.user.role === "expert" && req.user.expertProfile?.verificationStatus === "verified") {
    return next();
  }
  const status = req.user?.expertProfile?.verificationStatus;
  if (req.user?.role === "expert" && status === "pending") {
    return res.status(403).json({ message: "Your expert account is still pending admin verification" });
  }
  if (req.user?.role === "expert" && status === "rejected") {
    return res.status(403).json({
      message: "Your expert verification was rejected. Update your qualification details and contact support.",
      adminNote: req.user.expertProfile?.adminNote || "",
    });
  }
  return res.status(403).json({ message: "This action requires a verified expert/teacher account" });
};

module.exports = { protect, adminOnly, expertOnly, verifiedExpertOnly };
