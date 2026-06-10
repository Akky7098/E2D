const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const Enquiry = require("../models/Enquiry");
const MaterialCheck = require("../models/MaterialCheck");
const WhatsappMessage = require("../models/WhatsappMessage");
const WhatsappConversationBuffer = require("../models/WhatsappConversationBuffer");

const {
  extractMaterialFromText,
  extractShedAvailabilityFromReply,
  classifyIncomingWhatsappMessage,
} = require("./aiExtractionService");

const { assignShedByCategory } = require("./materialAssignmentService");
const { findDuplicateEnquiry } = require("./duplicateEnquiryService");

let client;

const ACTIVE_CHECK_STATUSES = [
  "pending",
  "unclear",
  "available",
  "near_available",
  "partial_available",
  "not_available",
];

const extractEnquiryNoFromText = (text = "") => {
  const match = text.match(/E2D-ENQ-\d+/i);
  return match ? match[0].toUpperCase() : null;
};

const getQuotedMessageId = (msg) => {
  return (
    msg?._data?.quotedStanzaID ||
    msg?._data?.quotedMsg?.id?.id ||
    msg?._data?.quotedMessageId ||
    null
  );
};

const initWhatsapp = async () => {
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: "e2d-material-availability",
      dataPath: "./whatsapp-sessions",
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log("Scan WhatsApp QR:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("WhatsApp ready");
  });

  client.on("message", async (msg) => {
    try {
      const body = msg.body?.trim() || "";

if (shouldIgnoreWhatsappMessage(msg, body)) {
  console.log("IGNORED WHATSAPP MESSAGE =>", msg.from, body);
  return;
}

console.log("WHATSAPP RECEIVED =>", msg.from);
console.log("MESSAGE =>", body);

await handleIncomingWhatsappMessage(msg);
    } catch (error) {
      console.error("WhatsApp message handling failed:", error.message);
    }
  });

  await client.initialize();
};

const sendWhatsappMessage = async (to, message) => {
  if (!client) throw new Error("WhatsApp client not initialized");

  const sent = await client.sendMessage(to, message);

  await WhatsappMessage.create({
    messageId: sent.id?._serialized,
    to,
    body: message,
    type: "outgoing",
  });

  return sent;
};

const safeSendWhatsappMessage = async (to, message) => {
  try {
    if (!to) {
      console.error("WhatsApp number missing");
      return null;
    }

    return await sendWhatsappMessage(to, message);
  } catch (error) {
    console.error("WhatsApp send failed:", {
      to,
      error: error.message,
    });

    return null;
  }
};

const findMaterialChecksForReply = async ({ from, body, msg }) => {
  let pendingChecks = [];

  const quotedMessageId = getQuotedMessageId(msg);

  if (quotedMessageId) {
    pendingChecks = await MaterialCheck.find({
      lastWhatsappMessageId: { $regex: quotedMessageId },
      status: { $in: ACTIVE_CHECK_STATUSES },
    })
      .populate("enquiryId")
      .sort({ lineNo: 1 });

    if (pendingChecks.length) {
      console.log("Matched shed reply by quoted WhatsApp message");
      return pendingChecks;
    }
  }

  const enquiryNo = extractEnquiryNoFromText(body);

  if (enquiryNo) {
    const enquiry = await Enquiry.findOne({ enquiryNo });

    if (enquiry) {
      pendingChecks = await MaterialCheck.find({
        enquiryId: enquiry._id,
        status: { $in: ACTIVE_CHECK_STATUSES },
      })
        .populate("enquiryId")
        .sort({ lineNo: 1 });

      if (pendingChecks.length) {
        console.log("Matched shed reply by enquiry number:", enquiryNo);
        return pendingChecks;
      }
    }
  }

  pendingChecks = await MaterialCheck.find({
    assignedWhatsappNumber: from,
    status: { $in: ["pending", "unclear"] },
  })
    .populate("enquiryId")
    .sort({ createdAt: -1 })
    .limit(30);

  if (pendingChecks.length) {
    console.log("Matched shed reply by sender fallback:", from);
  }

  return pendingChecks;
};
const shouldIgnoreWhatsappMessage = (msg, body = "") => {
  const from = msg.from || "";

  if (msg.fromMe) return true;
  if (from === "status@broadcast") return true;
  if (from.endsWith("@newsletter")) return true;

  // ignore groups for MVP
  if (from.endsWith("@g.us")) return true;

  const text = String(body || "").trim();
  if (text.length < 3) return true;

  const lower = text.toLowerCase();

  const hasBusinessSignal =
    /\d/.test(lower) ||
    lower.includes("need") ||
    lower.includes("required") ||
    lower.includes("requirement") ||
    lower.includes("stock") ||
    lower.includes("rate") ||
    lower.includes("quote") ||
    lower.includes("quotation") ||
    lower.includes("available") ||
    lower.includes("dispatch") ||
    lower.includes("material") ||
    lower.includes("grade") ||
    lower.includes("size") ||
    lower.includes("dia") ||
    lower.includes("round") ||
    lower.includes("flat") ||
    lower.includes("block") ||
    lower.includes("plate") ||
    lower.includes("pcs") ||
    lower.includes("piece") ||
    lower.includes("nos") ||
    lower.includes("qty") ||
    lower.includes("urgent") ||
    lower.includes("chahiye") ||
    lower.includes("bhejo") ||
    lower.includes("check") ||
    lower.includes("dekh") ||
    lower.includes("hai kya") ||
    lower.includes("milega") ||
    lower.includes("maal");

  if (hasBusinessSignal) return false;

  const greetingPatterns = [
    /^hi$/i,
    /^hello$/i,
    /^hii+$/i,
    /^hey$/i,
    /^ok$/i,
    /^okay$/i,
    /^thanks$/i,
    /^thank you$/i,
    /^good morning/i,
    /^good night/i,
    /^happy birthday/i,
    /^congratulations/i,
    /jai shree ram/i,
    /ganpati/i,
    /ganpati bappa/i,
    /mangal murti/i,
    /शुभ/i,
    /सुप्रभात/i,
  ];

  const emojiOnly = /^[\p{Emoji}\s🙏🌺🌹🎉✨❤️]+$/u.test(text);

  if (emojiOnly) return true;

  if (greetingPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  // Important:
  // Unknown text should NOT be ignored.
  // Let buffer + AI decide later.
  return false;
};
const handleIncomingWhatsappMessage = async (msg) => {
  const from = msg.from;
  const body = msg.body?.trim();

  if (!body) return;

  await WhatsappMessage.create({
    messageId: msg.id?._serialized,
    from,
    body,
    type: "incoming",
  });

  const pendingChecks = await findMaterialChecksForReply({
    from,
    body,
    msg,
  });

  if (pendingChecks.length > 0) {
    await handleShedReply(pendingChecks, body, from);
    return;
  }

  const classification = await classifyIncomingWhatsappMessage(body);

  console.log("MESSAGE CLASSIFICATION =>", classification);

  if (
    classification.intent === "availability_reply" &&
    classification.confidence >= 0.65
  ) {
    await safeSendWhatsappMessage(
      process.env.CEO_WHATSAPP,
      `⚠️ *E2D - Unmatched Stock Reply*

A WhatsApp message looks like a stock availability reply, but no enquiry/check could be matched.

*From:* ${from}

*Message:*
${body}

Please review manually from E2D dashboard.`
    );

    await WhatsappMessage.create({
      messageId: msg.id?._serialized,
      from,
      body,
      type: "incoming",
      mediaType: "unmatched_availability_reply",
    });

    return;
  }

  await addMessageToBuffer({
    from,
    body,
    whatsappMessageId: msg.id?._serialized,
  });
};

const addMessageToBuffer = async ({ from, body, whatsappMessageId }) => {
  let buffer = await WhatsappConversationBuffer.findOne({
    from,
    status: "collecting",
  }).sort({ createdAt: -1 });

  if (!buffer) {
    buffer = await WhatsappConversationBuffer.create({
      from,
      messages: [],
      status: "collecting",
      lastMessageAt: new Date(),
    });
  }

  const alreadyExists = buffer.messages.some(
    (m) => m.whatsappMessageId === whatsappMessageId
  );

  if (!alreadyExists) {
    buffer.messages.push({
      whatsappMessageId,
      body,
      receivedAt: new Date(),
    });
  }

  buffer.combinedText = buffer.messages.map((m) => m.body).join("\n\n");
  buffer.lastMessageAt = new Date();

  await buffer.save();

  console.log("Message added to buffer:", buffer._id);
};

const createEnquiryFromWhatsapp = async (body, from, whatsappMessageId) => {
  const existingByMessageId = await Enquiry.findOne({ whatsappMessageId });

  if (existingByMessageId) {
    console.log("Duplicate WhatsApp message ignored:", whatsappMessageId);
    return existingByMessageId;
  }

  const enquiry = await Enquiry.create({
    source: "whatsapp",
    whatsappMessageId,
    customerPhone: from,
    rawMessage: body,
    createdByWhatsappNumber: from,
    status: "pending_material_check",
    aiStatus: "pending",
    materials: [],
    materialCheckIds: [],
    extractedMaterial: {
      grade: "",
      materialType: "",
      category: "Other",
      size: "",
      quantity: 0,
      unit: "Nos",
    },
  });

  try {
    const extracted = await extractMaterialFromText(body);

    const duplicateCheck = await findDuplicateEnquiry({
      materials: extracted.materials,
      customerName: extracted.customerName,
      customerPhone: from,
    });

    if (duplicateCheck.isDuplicate) {
      enquiry.customerName = extracted.customerName || "";
      enquiry.aiStatus = "success";
      enquiry.aiConfidence = extracted.confidence || 0;
      enquiry.enquiryHash = duplicateCheck.enquiryHash;
      enquiry.isDuplicate = true;
      enquiry.duplicateOf = duplicateCheck.duplicate._id;
      enquiry.duplicateReason =
        "Same material enquiry found within last 10 days";
      enquiry.status = "closed";

      enquiry.materials = extracted.materials.map((m) => ({
        grade: m.grade,
        materialType: m.type,
        category: m.category,
        size: m.size,
        quantity: m.quantity,
        unit: m.unit,
      }));

      await enquiry.save();

      return enquiry;
    }

    enquiry.customerName = extracted.customerName || "";
    enquiry.aiStatus = "success";
    enquiry.aiConfidence = extracted.confidence || 0;
    enquiry.enquiryHash = duplicateCheck.enquiryHash;

    enquiry.materials = extracted.materials.map((m) => ({
      grade: m.grade,
      materialType: m.type,
      category: m.category,
      size: m.size,
      quantity: m.quantity,
      unit: m.unit,
    }));

    const firstMaterial = extracted.materials[0];

    if (firstMaterial) {
      enquiry.extractedMaterial = {
        grade: firstMaterial.grade,
        materialType: firstMaterial.type,
        category: firstMaterial.category,
        size: firstMaterial.size,
        quantity: firstMaterial.quantity,
        unit: firstMaterial.unit,
      };
    }

    await enquiry.save();

    await createGroupedMaterialChecksAndSend(enquiry, extracted.materials, body);

    return enquiry;
  } catch (error) {
    enquiry.aiStatus = "failed";
    enquiry.status = "escalated";
    await enquiry.save();

    await safeSendWhatsappMessage(
      process.env.CEO_WHATSAPP,
      `🚨 *E2D - AI Extraction Failed*

*Enquiry:* ${enquiry.enquiryNo}

Raw Message:
${body}

Please check manually from E2D dashboard.`
    );

    return enquiry;
  }
};

const createGroupedMaterialChecksAndSend = async (
  enquiry,
  materials,
  rawMessage
) => {
  const groupedByShed = {};

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    const shed = await assignShedByCategory(material.category || "Other");

    if (!shed) {
      enquiry.status = "escalated";
      await enquiry.save();

      await safeSendWhatsappMessage(
        process.env.CEO_WHATSAPP,
        `🚨 *E2D - No Shed Mapping Found*

*Enquiry:* ${enquiry.enquiryNo}

*Grade:* ${material.grade || "-"}
*Size:* ${material.size || "-"}
*Qty:* ${material.quantity || "-"} ${material.unit || "Nos"}

Raw Message:
${rawMessage}`
      );

      continue;
    }

    const materialCheck = await MaterialCheck.create({
      enquiryId: enquiry._id,
      lineNo: i + 1,
      assignedShed: shed._id,
      assignedWhatsappNumber: shed.whatsappNumber,
      grade: material.grade || "",
      type: material.type || "Other",
      category: material.category || "Other",
      size: material.size || "",
      requiredQuantity: material.quantity || 0,
      unit: material.unit || "Nos",
      status: "pending",
      availability: {
        status: "pending",
      },
    });

    enquiry.materialCheckIds.push(materialCheck._id);

    if (!enquiry.materialCheckId) {
      enquiry.materialCheckId = materialCheck._id;
    }

    const key = shed.whatsappNumber;

    if (!groupedByShed[key]) {
      groupedByShed[key] = {
        shed,
        checks: [],
      };
    }

    groupedByShed[key].checks.push(materialCheck);
  }

  await enquiry.save();

  for (const key of Object.keys(groupedByShed)) {
    const { shed, checks } = groupedByShed[key];

    const message = buildShedMaterialMessage({
      enquiry,
      checks,
    });

    const sent = await safeSendWhatsappMessage(shed.whatsappNumber, message);

    if (!sent) {
      await MaterialCheck.updateMany(
        {
          _id: { $in: checks.map((c) => c._id) },
        },
        {
          status: "escalated",
          escalatedAt: new Date(),
        }
      );

      enquiry.status = "escalated";
      await enquiry.save();
    } else {
      await MaterialCheck.updateMany(
        {
          _id: { $in: checks.map((c) => c._id) },
        },
        {
          lastWhatsappMessageId: sent.id?._serialized,
        }
      );
    }
  }
};

const buildShedMaterialMessage = ({ enquiry, checks }) => {
  const lines = checks
    .map((c, index) => {
      return `${index + 1}. ${c.grade || "-"} | ${c.size || "-"} | Qty: ${
        c.requiredQuantity || "-"
      } ${c.unit || "Nos"}`;
    })
    .join("\n");

  return `🏭 *E2D - Material Check Required*

You have *${checks.length}* material item(s) to check.

*Enquiry:* ${enquiry.enquiryNo}
*Customer:* ${enquiry.customerName || "-"}

${lines}

Please check stock and reply to this same WhatsApp message.

Also write this enquiry number in your reply:
*${enquiry.enquiryNo}*

You can reply in Hindi or English.`;
};

const handleShedReply = async (pendingChecks, body, from) => {
  const enquiry = pendingChecks[0]?.enquiryId;

  try {
    const aiResult = await extractShedAvailabilityFromReply({
      replyText: body,
      materialChecks: pendingChecks,
    });

    for (const response of aiResult.responses) {
      const check =
        pendingChecks.find(
          (c) => String(c._id) === String(response.checkId)
        ) || pendingChecks[Number(response.lineNo) - 1];

      if (!check) continue;

      check.status =
        response.status === "exact_available"
          ? "available"
          : response.status === "not_available"
          ? "not_available"
          : response.status;

      check.availability = {
        status: response.status || "unclear",
        availableSize: response.availableSize || "",
        availableQuantity: response.availableQuantity || 0,
        unit: response.unit || "Nos",
        remark: response.remark || "",
        rawReply: body,
        repliedAt: new Date(),
      };

      check.responseHistory.push({
        response: response.status || "unclear",
        responseBy: from,
        responseAt: new Date(),
        message: body,
      });

      await check.save();
    }

    await updateEnquiryStatusFromChecks(enquiry?._id);

    await safeSendWhatsappMessage(
      from,
      `✅ *E2D - Reply Saved*

*Enquiry:* ${enquiry?.enquiryNo || "-"}

Your stock reply has been updated in E2D dashboard.`
    );
  }  catch (error) {
    console.error("Shed reply AI failed:", error.message);

    for (const check of pendingChecks) {
      check.status = "unclear";
      check.availability = {
        status: "unclear",
        rawReply: body,
        remark: "AI could not understand shed reply. Manual review required.",
        repliedAt: new Date(),
      };

      check.responseHistory.push({
        response: "unclear",
        responseBy: from,
        responseAt: new Date(),
        message: body,
      });

      await check.save();
    }

    await updateEnquiryStatusFromChecks(enquiry?._id);

    await safeSendWhatsappMessage(
      from,
      `⚠️ *E2D - Reply Not Clear*

*Enquiry:* ${enquiry?.enquiryNo || "-"}

We could not understand your stock reply.

Please send simply:

*EN24 75 = 3 pcs*
*EN31 90 = nahi*
*EN31 85 = 2 pcs*

You can also send a voice note or photo.`
    );

    await safeSendWhatsappMessage(
      process.env.CEO_WHATSAPP,
      `⚠️ *E2D - Shed Reply Needs Review*

*Enquiry:* ${enquiry?.enquiryNo || "-"}

Shed reply was not understood.

*From:* ${from}

*Reply:*
${body}

Please review manually from E2D dashboard.`
    );
}
};

const updateEnquiryStatusFromChecks = async (enquiryId) => {
  if (!enquiryId) return;

  const checks = await MaterialCheck.find({ enquiryId });

  if (!checks.length) return;

  const statuses = checks.map((c) => c.availability?.status || c.status);

  let enquiryStatus = "pending_material_check";

  if (statuses.every((s) => s === "exact_available")) {
    enquiryStatus = "available";
  } else if (statuses.every((s) => s === "not_available")) {
    enquiryStatus = "not_available";
  } else if (
    statuses.some((s) =>
      ["exact_available", "near_available", "partial_available"].includes(s)
    )
  ) {
    enquiryStatus = "partial_available";
  }

  await Enquiry.findByIdAndUpdate(enquiryId, {
    status: enquiryStatus,
  });
};

module.exports = {
  initWhatsapp,
  sendWhatsappMessage,
  safeSendWhatsappMessage,
  createEnquiryFromWhatsapp,
};