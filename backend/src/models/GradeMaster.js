const mongoose = require("mongoose");

const gradeMasterSchema = new mongoose.Schema(
  {
    standardGrade: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    aliases: [
      {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
      },
    ],

    category: {
      type: String,
      enum: [
        "Tool Steel",
        "Alloy Steel",
        "Plastic Mould Steel",
        "Stainless Steel",
        "Carbon Steel",
        "Other",
      ],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GradeMaster", gradeMasterSchema);