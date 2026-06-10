const express = require("express");
const {
  getUsers,
  updateUserStatus,
} = require("../controllers/userController");

const { protect, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  protect,
  authorize("super_admin", "admin"),
  getUsers
);

router.patch(
  "/:id/status",
  protect,
  authorize("super_admin", "admin"),
  updateUserStatus
);

module.exports = router;