const mongoose = require("mongoose");

const whatsappMessageSchema = new mongoose.Schema(
  {
    messageId: String,
    from: String,
    to: String,
    body: String,

    type: {
      type: String,
      enum: ["incoming", "outgoing"],
    },

    mediaType: String,
    mediaUrl: String,

    relatedEnquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
    },

    relatedMaterialCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialCheck",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WhatsappMessage", whatsappMessageSchema);