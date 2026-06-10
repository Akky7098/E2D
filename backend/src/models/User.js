const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    whatsappNumber: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "super_admin",
        "admin",
        "sales",
        "dispatch",
        "supervisor",
        "shed_user",
      ],
      required: true,
      default: "sales",
    },

    assignedShed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shed",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: Date,
  },
  { timestamps: true }
);


module.exports = mongoose.model("User", userSchema);