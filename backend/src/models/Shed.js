const mongoose = require("mongoose");

const shedSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    materialCategories: [
      {
        type: String,
      },
    ],

    contactPerson: String,

    whatsappNumber: {
      type: String,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    priority: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shed", shedSchema);