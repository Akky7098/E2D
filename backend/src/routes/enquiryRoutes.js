const express = require("express");

const {
  createManualEnquiry,
  getEnquiries,
  getEnquiryById,
  getProductGrades,
  getActiveSheds,
} = require("../controllers/enquiryController");

const { protect, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/grades",
  protect,
  authorize("super_admin", "admin", "sales", "supervisor", "dispatch"),
  getProductGrades
);

router.get(
  "/sheds",
  protect,
  authorize("super_admin", "admin", "sales", "supervisor", "dispatch"),
  getActiveSheds
);

router.post(
  "/",
  protect,
  authorize("super_admin", "admin", "sales", "supervisor"),
  createManualEnquiry
);

router.get(
  "/",
  protect,
  authorize("super_admin", "admin", "sales", "supervisor", "dispatch"),
  getEnquiries
);

router.get(
  "/:id",
  protect,
  authorize("super_admin", "admin", "sales", "supervisor", "dispatch"),
  getEnquiryById
);

module.exports = router;