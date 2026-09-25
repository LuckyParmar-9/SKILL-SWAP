const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    subCategories: [{ type: String, trim: true }], // e.g. Programming -> ["Web Development", "Data Science"]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
