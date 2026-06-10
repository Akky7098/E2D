const cron = require("node-cron");
const MaterialCheck = require("../models/MaterialCheck");
const Enquiry = require("../models/Enquiry");
const { safeSendWhatsappMessage } = require("../services/whatsappService");

const REMINDER_1_MINUTES = 15;
const REMINDER_2_MINUTES = 30;
const ESCALATION_MINUTES = 45;

const buildReminderMessage = (checks, enquiry, reminderNo) => {
  const lines = checks
    .map((c, index) => {
      return `${index + 1}. ${c.grade || "-"} | ${c.size || "-"} | Qty: ${
        c.requiredQuantity || "-"
      } ${c.unit || "Nos"}`;
    })
    .join("\n");

  return `⏰ *E2D - Material Check Reminder ${reminderNo}*

You have *${checks.length}* material item(s) pending.

*Enquiry:* ${enquiry?.enquiryNo || "-"}
*Customer:* ${enquiry?.customerName || "-"}

${lines}

Please check stock and reply in your own words.

You can reply in Hindi or English.`;
};

const buildEscalationMessage = (checks, enquiry, assignedWhatsappNumber) => {
  const lines = checks
    .map((c, index) => {
      return `${index + 1}. ${c.grade || "-"} | ${c.size || "-"} | Qty: ${
        c.requiredQuantity || "-"
      } ${c.unit || "Nos"}`;
    })
    .join("\n");

  return `🚨 *E2D - Material Check Escalated*

No response received for *${checks.length}* material item(s).

*Enquiry:* ${enquiry?.enquiryNo || "-"}
*Customer:* ${enquiry?.customerName || "-"}
*Assigned Shed:* ${assignedWhatsappNumber || "-"}

Pending items:

${lines}

Please check from E2D dashboard.`;
};

const startMaterialEscalationCron = () => {
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    const pendingChecks = await MaterialCheck.find({
      status: "pending",
    }).populate("enquiryId");

    const grouped = {};

    for (const check of pendingChecks) {
      const enquiryId = check.enquiryId?._id || check.enquiryId || "NO_ENQUIRY";
      const key = `${enquiryId}_${check.assignedWhatsappNumber}`;

      if (!grouped[key]) grouped[key] = [];

      grouped[key].push(check);
    }

    for (const key of Object.keys(grouped)) {
      const checks = grouped[key];
      const first = checks[0];
      const enquiry = first.enquiryId;

      const createdAt = new Date(first.createdAt);
      const diffMinutes = Math.floor((now - createdAt) / 60000);

      if (diffMinutes >= REMINDER_1_MINUTES && !first.reminder1SentAt) {
        await safeSendWhatsappMessage(
          first.assignedWhatsappNumber,
          buildReminderMessage(checks, enquiry, 1)
        );

        await MaterialCheck.updateMany(
          {
            _id: { $in: checks.map((c) => c._id) },
          },
          {
            reminder1SentAt: now,
          }
        );
      }

      if (diffMinutes >= REMINDER_2_MINUTES && !first.reminder2SentAt) {
        await safeSendWhatsappMessage(
          first.assignedWhatsappNumber,
          buildReminderMessage(checks, enquiry, 2)
        );

        await MaterialCheck.updateMany(
          {
            _id: { $in: checks.map((c) => c._id) },
          },
          {
            reminder2SentAt: now,
          }
        );
      }

      if (diffMinutes >= ESCALATION_MINUTES && !first.escalatedAt) {
        await MaterialCheck.updateMany(
          {
            _id: { $in: checks.map((c) => c._id) },
          },
          {
            status: "escalated",
            escalatedAt: now,
          }
        );

        if (enquiry?._id) {
          await Enquiry.findByIdAndUpdate(enquiry._id, {
            status: "escalated",
          });
        }

        await safeSendWhatsappMessage(
          process.env.CEO_WHATSAPP,
          buildEscalationMessage(
            checks,
            enquiry,
            first.assignedWhatsappNumber
          )
        );
      }
    }
  });

  console.log("Material escalation cron started");
};

module.exports = {
  startMaterialEscalationCron,
};