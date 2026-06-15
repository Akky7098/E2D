const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require("path");
const fs = require("fs");

const Enquiry = require("../models/Enquiry");
const MaterialCheck = require("../models/MaterialCheck");
const WhatsappMessage = require("../models/WhatsappMessage");
const WhatsappConversationBuffer = require("../models/WhatsappConversationBuffer");

const { extractMaterialFromText } = require("./aiExtractionService");
const { assignShedByCategory } = require("./materialAssignmentService");
const { findDuplicateEnquiry } = require("./duplicateEnquiryService");

let client = null;
let isReady = false;
let isInitializing = false;
let latestQr = null;
let lastState = "NOT_INITIALIZED";
let lastError = null;

const authClientId = "e2d-material-availability";

const whatsappSessionPath =
  process.env.WHATSAPP_SESSION_PATH ||
  path.join(process.env.HOME || process.cwd(), "whatsapp-session-e2d");

const whatsappCachePath = path.join(whatsappSessionPath, "wwebjs-cache");

const ensureSessionFolder = () => {
  try {
    fs.mkdirSync(whatsappSessionPath, { recursive: true });
    fs.mkdirSync(whatsappCachePath, { recursive: true });

    const testFile = path.join(whatsappSessionPath, "_session_write_test.txt");
    fs.writeFileSync(testFile, "ok");

    console.log("WHATSAPP SESSION PATH =>", whatsappSessionPath);
    console.log(
      "WHATSAPP LOCAL AUTH PATH =>",
      path.join(whatsappSessionPath, `session-${authClientId}`)
    );
    console.log("WHATSAPP CACHE PATH =>", whatsappCachePath);
    console.log("WHATSAPP SESSION WRITE OK =>", fs.existsSync(testFile));
  } catch (error) {
    console.log("WHATSAPP SESSION FOLDER ERROR =>", error.message);
  }
};

const mapTypeToShape = (type = "", size = "") => {
  const text = `${type} ${size}`.toLowerCase();

  if (text.includes("round") || text.includes("dia") || text.includes("diameter")) {
    return "round";
  }

  if (text.includes("flat") || text.includes("plate")) {
    return "flat";
  }

  if (text.includes("square")) {
    return "square";
  }

  if (text.includes("rcs")) {
    return "rcs";
  }

  return "flat";
};

const mapCategoryToEnquiryCategory = (category = "") => {
  const text = String(category || "").toLowerCase();

  if (text.includes("tool")) return "tool_and_die_steel";
  if (text.includes("plastic")) return "plastic_mould_steel";
  if (text.includes("hss") || text.includes("high speed")) return "high_speed_steel";
  if (text.includes("alloy")) return "alloy_steel";
  if (text.includes("carbon") || text.includes("mild")) return "carbon_steel";

  return "other";
};

const initWhatsapp = async () => {
  if (client) return client;

  if (isInitializing) {
    console.log("WhatsApp already initializing...");
    return client;
  }

  ensureSessionFolder();

  isInitializing = true;
  lastError = null;
  lastState = "INITIALIZING";

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: authClientId,
      dataPath: whatsappSessionPath,
    }),

    webVersionCache: {
      type: "local",
      path: whatsappCachePath,
    },

    puppeteer: {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-zygote",
    "--single-process",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--disable-features=site-per-process,TranslateUI",
  ],
  userDataDir: path.join(whatsappSessionPath, "chrome-user-data"),
},
  });

  client.on("qr", (qr) => {
    isReady = false;
    isInitializing = false;
    latestQr = qr;
    lastState = "QR_REQUIRED";

    console.log("Scan WhatsApp QR:");
    qrcode.generate(qr, { small: true });
  });

  client.on("authenticated", () => {
    console.log("WhatsApp authenticated");
    console.log("WhatsApp session saved at:", whatsappSessionPath);
    lastState = "AUTHENTICATED";
  });

  client.on("ready", () => {
    isReady = true;
    isInitializing = false;
    latestQr = null;
    lastState = "CONNECTED";
    lastError = null;

    console.log("WhatsApp ready");
  });

  client.on("auth_failure", (msg) => {
    isReady = false;
    isInitializing = false;
    latestQr = null;
    lastState = "AUTH_FAILURE";
    lastError = msg;

    console.log("WhatsApp auth failed:", msg);
  });

  client.on("disconnected", async (reason) => {
    isReady = false;
    isInitializing = false;
    latestQr = null;
    lastState = "DISCONNECTED";
    lastError = reason;

    console.log("WhatsApp disconnected:", reason);

    try {
      if (client) await client.destroy().catch(() => {});
    } catch (error) {
      console.log("WhatsApp destroy error:", error.message);
    }

    client = null;

    setTimeout(() => {
      initWhatsapp().catch((error) => {
        console.log("WhatsApp auto restart failed:", error.message);
      });
    }, 8000);
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

  client.initialize().catch((error) => {
    isReady = false;
    isInitializing = false;
    latestQr = null;
    lastState = "INIT_FAILED";
    lastError = error.message;

    console.log("WhatsApp initialize error:", error.message);

    client = null;
  });

  return client;
};

const getWhatsappClient = () => {
  if (!client && !isInitializing) {
    initWhatsapp().catch((error) => {
      console.log("WhatsApp init error:", error.message);
    });
  }

  return client;
};

const forceCheckWhatsappStatus = async () => {
  try {
    if (!client) {
      if (!isInitializing) await initWhatsapp();

      return {
        ready: false,
        state: lastState || "INITIALIZING",
        qr: latestQr,
        error: lastError,
        sessionPath: whatsappSessionPath,
      };
    }

    const state = await client.getState().catch(() => null);

    if (state === "CONNECTED") {
      isReady = true;
      lastState = "CONNECTED";

      return {
        ready: true,
        state,
        qr: null,
        error: null,
        sessionPath: whatsappSessionPath,
      };
    }

    isReady = false;
    lastState = state || lastState || "NOT_CONNECTED";

    return {
      ready: false,
      state: lastState,
      qr: latestQr,
      error: lastError,
      sessionPath: whatsappSessionPath,
    };
  } catch (error) {
    isReady = false;
    lastState = "DISCONNECTED";
    lastError = error.message;

    return {
      ready: false,
      state: "DISCONNECTED",
      qr: latestQr,
      error: error.message,
      sessionPath: whatsappSessionPath,
    };
  }
};

const restartWhatsappClient = async () => {
  try {
    if (client) await client.destroy().catch(() => {});
  } catch (error) {
    console.log("WhatsApp destroy error:", error.message);
  }

  client = null;
  isReady = false;
  isInitializing = false;
  latestQr = null;
  lastState = "RESTARTING";
  lastError = null;

  return initWhatsapp();
};

const destroyWhatsappClient = async () => {
  try {
    if (client) await client.destroy();
  } catch (error) {
    console.log("WhatsApp destroy error:", error.message);
  }

  client = null;
  isReady = false;
  isInitializing = false;
  latestQr = null;
  lastState = "DESTROYED";
};

const sendWhatsappMessage = async (to, message) => {
  if (!client || !isReady) {
    throw new Error("WhatsApp client not ready");
  }

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

    const status = await forceCheckWhatsappStatus();

    if (!status.ready) {
      console.log("WhatsApp not ready. Message skipped:", {
        to,
        state: status.state,
      });
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

  return greetingPatterns.some((pattern) => pattern.test(text));
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
    extractionSource: "ai",
    materials: [],
    materialCheckIds: [],
    extractedMaterial: {
      grade: "",
      shape: "flat",
      category: "other",
      size: "",
      quantity: 0,
      unit: "Nos",
    },
  });

  try {
    const extracted = await extractMaterialFromText(body);

    if (!extracted.materials || extracted.materials.length === 0) {
      enquiry.aiStatus = "failed";
      enquiry.extractionSource = extracted.extractionSource || "manual";
      enquiry.status = "manual_review";
      await enquiry.save();
      return enquiry;
    }

    const duplicateCheck = await findDuplicateEnquiry({
      materials: extracted.materials,
      customerName: extracted.customerName,
      customerPhone: from,
    });

    const enquiryMaterials = extracted.materials.map((m) => ({
      grade: m.grade,
      otherGrade: "",
      shape: mapTypeToShape(m.type || m.materialType, m.size),
      category: mapCategoryToEnquiryCategory(m.category),
      size: m.size,
      quantity: m.quantity,
      unit: m.unit || "Nos",
      manualShedIds: [],
    }));

    enquiry.customerName = extracted.customerName || "";
    enquiry.aiStatus = "success";
    enquiry.extractionSource = extracted.extractionSource || "ai";
    enquiry.aiConfidence = extracted.confidence || 0;
    enquiry.enquiryHash = duplicateCheck.enquiryHash;
    enquiry.materials = enquiryMaterials;

    const firstMaterial = enquiryMaterials[0];
    if (firstMaterial) enquiry.extractedMaterial = firstMaterial;

    if (duplicateCheck.isDuplicate) {
      enquiry.isDuplicate = true;
      enquiry.duplicateOf = duplicateCheck.duplicate._id;
      enquiry.duplicateReason = "Same material enquiry found within last 10 days";
      enquiry.duplicateDetectedAt = new Date();
      enquiry.status = "closed";

      await enquiry.save();
      return enquiry;
    }

    await enquiry.save();

    await createGroupedMaterialChecksAndSend(enquiry, extracted.materials, body);

    return enquiry;
  } catch (error) {
    console.error("Material extraction failed:", error.message);

    enquiry.aiStatus = "failed";
    enquiry.extractionSource = "manual";
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

const createGroupedMaterialChecksAndSend = async (enquiry, materials, rawMessage) => {
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
      type: material.type || material.materialType || "Other",
      category: material.category || "Other",
      size: material.size || "",
      requiredQuantity: material.quantity || 0,
      unit: material.unit || "Nos",
      status: "pending",
      requested: {
        grade: material.grade || "",
        materialType: material.type || material.materialType || "Other",
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

    const key = shed.whatsappNumber;

    if (!groupedByShed[key]) {
      groupedByShed[key] = { shed, checks: [] };
    }

    groupedByShed[key].checks.push(materialCheck);
  }

  await enquiry.save();

  for (const key of Object.keys(groupedByShed)) {
    const { shed, checks } = groupedByShed[key];

    const sent = await safeSendWhatsappMessage(
      shed.whatsappNumber,
      buildShedMaterialMessage({ enquiry, checks })
    );

    if (!sent) {
      await MaterialCheck.updateMany(
        { _id: { $in: checks.map((c) => c._id) } },
        { status: "escalated", escalatedAt: new Date() }
      );

      enquiry.status = "manual_review";
      await enquiry.save();
    } else {
      await MaterialCheck.updateMany(
        { _id: { $in: checks.map((c) => c._id) } },
        { lastWhatsappMessageId: sent.id?._serialized }
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

module.exports = {
  initWhatsapp,
  initWhatsappClient: initWhatsapp,
  getWhatsappClient,
  forceCheckWhatsappStatus,
  restartWhatsappClient,
  destroyWhatsappClient,
  sendWhatsappMessage,
  safeSendWhatsappMessage,
  createEnquiryFromWhatsapp,
};