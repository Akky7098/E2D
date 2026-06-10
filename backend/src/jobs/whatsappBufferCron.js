const cron = require("node-cron");
const WhatsappConversationBuffer = require("../models/WhatsappConversationBuffer");
const { createEnquiryFromWhatsapp } = require("../services/whatsappService");

const BUFFER_WAIT_MINUTES = 2;

const startWhatsappBufferCron = () => {
  cron.schedule("* * * * *", async () => {
    const cutoff = new Date(Date.now() - BUFFER_WAIT_MINUTES * 60 * 1000);

    const buffers = await WhatsappConversationBuffer.find({
      status: "collecting",
      lastMessageAt: { $lte: cutoff },
    }).limit(10);

    for (const buffer of buffers) {
      try {
        buffer.status = "processing";
        await buffer.save();

        await createEnquiryFromWhatsapp(
          buffer.combinedText,
          buffer.from,
          buffer.messages.map((m) => m.whatsappMessageId).join("|")
        );

        buffer.status = "processed";
        buffer.processedAt = new Date();
        await buffer.save();
      } catch (error) {
        buffer.status = "failed";
        await buffer.save();

        console.error("Buffer processing failed:", error.message);
      }
    }
  });

  console.log("WhatsApp buffer cron started");
};

module.exports = {
  startWhatsappBufferCron,
};