const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  getMaterialChecks,
  getPendingMaterialChecks,
  updateMaterialCheck,
} = require("../controllers/materialCheckController");

const { protect, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    cb(
      null,
      `material-update-audio-${unique}${path.extname(file.originalname) || ".webm"}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.get("/", protect, getMaterialChecks);

router.get("/pending", protect, getPendingMaterialChecks);

router.put(
  "/:id/update",
  protect,
  authorize("super_admin", "admin", "supervisor", "dispatch", "user"),
  upload.single("audioFile"),
  updateMaterialCheck
);

module.exports = router;