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

    requiredQuantity: {
      type: Number,
      default: 0,
    },

    unit: {
      type: String,
      default: "Nos",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "available",
        "exact_available",
        "near_available",
        "partial_available",
        "not_available",
        "unclear",
        "escalated",
      ],
      default: "pending",
    },

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

      availableQuantity: {
        type: Number,
        default: 0,
      },

      unit: {
        type: String,
        default: "Nos",
      },

      remark: String,

      rawReply: String,

      updatedAt: Date,
    },

    updateSource: {
      type: String,
      enum: [
        "system",
        "whatsapp",
        "frontend",
      ],
      default: "system",
    },

    audioAttachment: {
      fileName: String,
      filePath: String,
      originalName: String,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedByName: String,
    updatedByRole: String,

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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "MaterialCheck",
  materialCheckSchema
);