const express = require("express");

const {
  getWhatsappStatus,
  showWhatsappQrPage,
  restartWhatsapp,
  restartWhatsappPage,
} = require("../controllers/whatsappController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/status", protect, getWhatsappStatus);
router.post("/restart", protect, restartWhatsapp);

/* Browser pages without auth, useful on Hostinger QR scan */
router.get("/status-page", showWhatsappQrPage);
router.get("/restart-page", restartWhatsappPage);

module.exports = router;