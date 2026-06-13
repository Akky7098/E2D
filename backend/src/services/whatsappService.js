const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const Enquiry = require("../models/Enquiry");
const MaterialCheck = require("../models/MaterialCheck");
const WhatsappMessage = require("../models/WhatsappMessage");
const WhatsappConversationBuffer = require("../models/WhatsappConversationBuffer");

const { extractMaterialFromText } = require("./aiExtractionService");
const { assignShedByCategory } = require("./materialAssignmentService");
const { findDuplicateEnquiry } = require("./duplicateEnquiryService");

let client;

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

const shouldIgnoreWhatsappMessage = (msg, body = "") => {
  const from = msg.from || "";

  if (msg.fromMe) return true;
  if (from === "status@broadcast") return true;
  if (from.endsWith("@newsletter")) return true;

  // Ignore groups for MVP
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

  // IMPORTANT:
  // E2D does NOT update material availability from WhatsApp replies now.
  // WhatsApp is only for enquiry intake.
  // Shed stock update must happen from E2D frontend app.

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
    enquiry.aiStatus =
      extracted.extractionSource === "regex" ? "success" : "success";
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
    console.error("Material extraction failed:", error.message);

    enquiry.aiStatus = "failed";
    enquiry.status = "manual_review";
    await enquiry.save();

    await safeSendWhatsappMessage(
      process.env.CEO_WHATSAPP,
      `⚠️ *E2D - Manual Review Required*

*Enquiry:* ${enquiry.enquiryNo}

Raw enquiry was saved, but material extraction did not happen automatically.

Please review from E2D dashboard.

Raw Message:
${body}`
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
      enquiry.status = "manual_review";
      await enquiry.save();

      await safeSendWhatsappMessage(
        process.env.CEO_WHATSAPP,
        `⚠️ *E2D - Shed Mapping Required*

*Enquiry:* ${enquiry.enquiryNo}

No shed mapping found for:

*Grade:* ${material.grade || "-"}
*Category:* ${material.category || "-"}
*Size:* ${material.size || "-"}
*Qty:* ${material.quantity || "-"} ${material.unit || "Nos"}

Please assign/check from E2D dashboard.

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
      requested: {
        grade: material.grade || "",
        materialType: material.type || "Other",
        category: material.category || "Other",
        size: material.size || "",
        quantity: material.quantity || 0,
        unit: material.unit || "Nos",
      },
      availability: {
        status: "pending",
        availableQuantity: 0,
        unit: material.unit || "Nos",
      },
      updateSource: "system",
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

      enquiry.status = "manual_review";
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

You have *${checks.length}* material item(s).

*Enquiry:* ${enquiry.enquiryNo}
*Customer:* ${enquiry.customerName || "-"}

${lines}

Please check stock physically and update availability from E2D Dashboard.

⚠️ WhatsApp stock replies are disabled.`;
};

/*
==================================================
FUTURE WHATSAPP STOCK REPLY ENGINE - DISABLED
==================================================

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

const findMaterialChecksForReply = async ({ from, body, msg }) => {
  // Disabled. Use frontend update form instead.
};

const handleShedReply = async (pendingChecks, body, from) => {
  // Disabled. Use frontend update form instead.
};

const updateEnquiryStatusFromChecks = async (enquiryId) => {
  // Disabled here. Enquiry status is now updated from materialCheckUpdateService.
};

==================================================
*/

module.exports = {
  initWhatsapp,
  sendWhatsappMessage,
  safeSendWhatsappMessage,
  createEnquiryFromWhatsapp,
};