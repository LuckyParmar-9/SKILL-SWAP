// Run with: node seed.js  (from inside the server/ folder, after setting up .env)
// Populates a brand-new, empty MongoDB database with:
//  - default skill categories + sub-categories (powers the Search filters & skill-add dropdowns)
//  - a demo admin account
//  - a couple of demo regular users with offered/wanted skills (so Matches & Search return something)
//  - one pre-verified demo expert with a paid listing + slot (so Paid Learning has something to book)
// Safe to re-run: it skips anything that already exists instead of duplicating it.
require("dotenv").config();
const connectDB = require("./config/db");
const User = require("./models/User");
const Category = require("./models/Category");
const PaidListing = require("./models/PaidListing");

const CATEGORIES = [
  { name: "Programming", description: "Software & web development", subCategories: ["Web Development", "Mobile Development", "Data Science", "DevOps"] },
  { name: "Music", description: "Instruments & vocals", subCategories: ["Guitar", "Piano", "Vocals", "Music Production"] },
  { name: "Language", description: "Spoken & written languages", subCategories: ["English", "Hindi", "Spanish", "French"] },
  { name: "Design", description: "Visual & product design", subCategories: ["UI/UX", "Graphic Design", "Illustration"] },
  { name: "Fitness", description: "Health & physical training", subCategories: ["Yoga", "Strength Training", "Nutrition"] },
  { name: "Business", description: "Professional & business skills", subCategories: ["Marketing", "Public Speaking", "Excel"] },
];

const seed = async () => {
  await connectDB();

  // 1. Categories
  for (const cat of CATEGORIES) {
    const exists = await Category.findOne({ name: cat.name });
    if (!exists) await Category.create(cat);
  }
  console.log(`Categories ready (${CATEGORIES.length}).`);

  // 2. Demo admin
  let admin = await User.findOne({ email: "admin@skillswap.local" });
  if (!admin) {
    admin = await User.create({
      name: "SkillSwap Admin",
      email: "admin@skillswap.local",
      password: "Admin@123", // CHANGE THIS after first login
      role: "admin",
    });
    console.log("Demo admin created: admin@skillswap.local / Admin@123 (change this password!)");
  }

  // 3. Demo regular users with complementary skills (so Matches & Search return results)
  let asha = await User.findOne({ email: "asha@example.com" });
  if (!asha) {
    asha = await User.create({
      name: "Asha Verma",
      email: "asha@example.com",
      password: "Password@123",
      bio: "Frontend developer who loves teaching React.",
      location: "Indore, India",
      offeredSkills: [
        { skill: "React", category: "Programming", subCategory: "Web Development", level: "Advanced", mode: "Online Video", language: "Hinglish" },
      ],
      wantedSkills: [
        { skill: "Guitar", category: "Music", subCategory: "Guitar", level: "Beginner", mode: "Online Video", language: "English" },
      ],
    });
    console.log("Demo user created: asha@example.com / Password@123");
  }

  let raj = await User.findOne({ email: "raj@example.com" });
  if (!raj) {
    raj = await User.create({
      name: "Raj Malhotra",
      email: "raj@example.com",
      password: "Password@123",
      bio: "Musician teaching guitar for 8 years.",
      location: "Mumbai, India",
      offeredSkills: [
        { skill: "Guitar", category: "Music", subCategory: "Guitar", level: "Expert", mode: "Offline", language: "Hindi" },
      ],
      wantedSkills: [
        { skill: "React", category: "Programming", subCategory: "Web Development", level: "Beginner", mode: "Online Video", language: "Hinglish" },
      ],
    });
    console.log("Demo user created: raj@example.com / Password@123 (mutual match with Asha)");
  }

  // 4. Demo pre-verified expert with a paid listing, so /paid-providers isn't empty
  let expert = await User.findOne({ email: "expert@example.com" });
  if (!expert) {
    expert = await User.create({
      name: "Dr. Meera Iyer",
      email: "expert@example.com",
      password: "Password@123",
      role: "expert",
      bio: "Data science trainer, 10 years industry experience.",
      location: "Bengaluru, India",
      expertProfile: {
        qualification: "PhD in Computer Science",
        experience: "10 years teaching Python & Data Science professionally",
        certificateUrl: "",
        verificationStatus: "verified",
        verifiedAt: new Date(),
      },
      offeredSkills: [
        { skill: "Python for Data Science", category: "Programming", subCategory: "Data Science", level: "Expert", mode: "Online Video", language: "English" },
      ],
    });
    console.log("Demo verified expert created: expert@example.com / Password@123");

    const listing = await PaidListing.create({
      provider: expert._id,
      skill: "Python for Data Science",
      category: "Programming",
      description: "1-on-1 introduction to pandas, numpy and data visualization for beginners.",
      price: 999,
      duration: 60,
      slots: [
        { date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), startTime: "18:00", endTime: "19:00" },
        { date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), startTime: "19:00", endTime: "20:00" },
      ],
    });
    console.log(`Demo paid listing created (${listing.skill}).`);
  }

  console.log("\nSeed complete. Log in at /login with any demo account above.");
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
