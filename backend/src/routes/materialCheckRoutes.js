const express = require("express");
const {
  getMaterialChecks,
  getPendingMaterialChecks,
} = require("../controllers/materialCheckController");

const router = express.Router();

router.get("/", getMaterialChecks);
router.get("/pending", getPendingMaterialChecks);

module.exports = router;