const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

// Public read-only list of categories + sub-categories, used to populate the
// "add skill" forms and the skill-search filters. Admin CRUD lives in routes/admin.js.
router.get("/", async (req, res) => {
  const categories = await Category.find().sort("name");
  res.json(categories);
});

module.exports = router;
