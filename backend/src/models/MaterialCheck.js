const mongoose = require("mongoose");

const materialCheckSchema = new mongoose.Schema(
  {
    enquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
      required: true,
    },

    assignedShed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shed",
    },

    assignedWhatsappNumber: String,

    grade: String,
    type: String,
    category: String,
    size: String,
    requiredQuantity: Number,
    unit: String,

    status: {
  type: String,
  enum: [
    "pending",
    "available",
    "exact_available",
    "near_available",
    "partial_available",
    "not_available",
    "waiting_partial_quantity",
    "unclear",
    "escalated",
  ],
  default: "pending",
},

    availableQuantity: Number,

    responseHistory: [
      {
        response: String,
        responseBy: String,
        responseAt: Date,
        message: String,
      },
    ],

    reminder1SentAt: Date,
    reminder2SentAt: Date,
    escalatedAt: Date,

    lastWhatsappMessageId: String,
    lineNo: Number,

requested: {
  grade: String,
  materialType: String,
  category: String,
  size: String,
  quantity: Number,
  unit: String,
},

availability: {
  status: {
    type: String,
    enum: [
      "pending",
      "exact_available",
      "near_available",
      "partial_available",
      "not_available",
      "unclear",
    ],
    default: "pending",
  },

  availableSize: String,
  availableQuantity: Number,
  remark: String,
  rawReply: String,
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaterialCheck", materialCheckSchema);