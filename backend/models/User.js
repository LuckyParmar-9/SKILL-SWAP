const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const skillEntrySchema = new mongoose.Schema(
  {
    skill: { type: String, required: true, trim: true },
    category: { type: String, default: "General" },
    subCategory: { type: String, default: "" },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: "Beginner",
    },
    mode: {
      type: String,
      enum: ["Online Voice", "Online Video", "Offline"],
      default: "Online Video",
    },
    language: {
      type: String,
      enum: ["Hindi", "English", "Hinglish"],
      default: "English",
    },
    description: { type: String, default: "" },
  },
  { _id: true, timestamps: true }
);

// Filled in only for "expert" accounts, at registration time. Admin reviews this
// before an expert is allowed to publish paid listings (see PaidListing routes).
const expertProfileSchema = new mongoose.Schema(
  {
    qualification: { type: String, required: true }, // e.g. "B.Tech CSE, Certified AWS Architect"
    experience: { type: String, required: true }, // e.g. "5 years teaching web development"
    certificateUrl: { type: String, default: "" }, // optional link to a certificate/portfolio proof
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    adminNote: { type: String, default: "" }, // reason shown to expert if rejected
    verifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    age: { type: Number, min: 13, max: 120, default: null },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Prefer not to say", ""],
      default: "",
    },
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    avatar: { type: String, default: "" },
    role: { type: String, enum: ["user", "expert", "admin"], default: "user" },
    status: { type: String, enum: ["active", "suspended", "blocked"], default: "active" },

    offeredSkills: [skillEntrySchema], // US-04, US-06
    wantedSkills: [skillEntrySchema], // US-05, US-06

    expertProfile: { type: expertProfileSchema, default: null }, // only set when role === "expert"

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);
