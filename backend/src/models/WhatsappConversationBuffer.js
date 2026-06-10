const mongoose = require("mongoose");

const whatsappConversationBufferSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      required: true,
      index: true,
    },

    messages: [
      {
        whatsappMessageId: String,
        body: String,
        receivedAt: Date,
        mediaType: String,
        mediaUrl: String,
      },
    ],

    combinedText: String,

    status: {
      type: String,
      enum: ["collecting", "processing", "processed", "failed"],
      default: "collecting",
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    processedAt: Date,

    enquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "WhatsappConversationBuffer",
  whatsappConversationBufferSchema
);