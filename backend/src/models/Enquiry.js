const mongoose = require("mongoose");

const materialLineSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      trim: true,
    },

    otherGrade: {
      type: String,
      trim: true,
    },

    shape: {
      type: String,
      enum: ["round", "flat", "square", "rcs"],
    },

    category: {
      type: String,
      enum: [
        "tool_and_die_steel",
        "plastic_mould_steel",
        "high_speed_steel",
        "alloy_steel",
        "carbon_steel",
        "other",
      ],
      default: "other",
    },

    size: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      default: 0,
    },

    unit: {
      type: String,
      trim: true,
      default: "Nos",
    },

    manualShedIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shed",
      },
    ],
  },
  { _id: false }
);

const enquirySchema = new mongoose.Schema(
  {
    enquiryNo: {
      type: String,
      unique: true,
      index: true,
    },

    source: {
      type: String,
      enum: ["whatsapp", "manual", "email", "phone", "image", "pdf", "voice"],
      default: "whatsapp",
    },

    customerType: {
      type: String,
      enum: ["india", "china", "germany", "gloria", "sbe_german", "other"],
      default: "india",
    },

    customerName: String,
    customerPhone: String,

    rawMessage: String,

    whatsappMessageId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    aiStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
     extractionSource: {
  type: String,
  enum: ["ai", "regex", "manual"],
  default: "ai",
},
    aiConfidence: {
      type: Number,
      default: 0,
    },

    extractedMaterial: materialLineSchema,

    materials: [materialLineSchema],

    materialCheckIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MaterialCheck",
      },
    ],

    materialCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialCheck",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdByName: String,
    createdByRole: String,

    assignedSupervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending_material_check",
        "available",
        "manual_review",
        "partial_available",
        "not_available",
        "escalated",
        "closed",
      ],
      default: "pending_material_check",
    },

    enquiryHash: {
      type: String,
      index: true,
    },

    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
      default: null,
    },

    isDuplicate: {
      type: Boolean,
      default: false,
    },

    duplicateReason: String,
    duplicateDetectedAt: Date,
    createdByWhatsappNumber: String,
  },
  { timestamps: true }
);

enquirySchema.pre("save", async function () {
  if (!this.enquiryNo) {
    const count = await mongoose.model("Enquiry").countDocuments();
    this.enquiryNo = `E2D-ENQ-${String(count + 1).padStart(5, "0")}`;
  }
});

module.exports = mongoose.model("Enquiry", enquirySchema);