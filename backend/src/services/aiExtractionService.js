// AI kept commented for future paid/stable version
// const { GoogleGenAI } = require("@google/genai");
// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

const {
  normalizeMaterialsWithGradeMaster,
} = require("./gradeMasterService");

const normalizeSize = (value = "") => {
  return String(value || "")
    .toLowerCase()
    .replace(/diameter/g, "dia")
    .replace(/ø/g, "dia")
    .replace(/\s+/g, "")
    .replace(/mm/g, "")
    .trim();
};

const normalizeMaterial = (material = {}) => ({
  grade: String(material.grade || "").trim().toUpperCase(),
  type: String(material.type || material.materialType || "Other").trim(),
  category: String(material.category || "Other").trim(),
  size: String(material.size || "").trim(),
  quantity: Number(material.quantity) || 0,
  unit: String(material.unit || "Nos").trim(),
  originalLine: String(material.originalLine || "").trim(),
  confidence: Number(material.confidence) || 0,
});

const buildEnquiryHash = (materials = [], customerName = "") => {
  const normalizedMaterials = materials
    .map((m) => ({
      grade: String(m.grade || "").toUpperCase().trim(),
      size: normalizeSize(m.size),
      qty: Number(m.quantity) || 0,
      unit: String(m.unit || "Nos").toLowerCase().trim(),
    }))
    .filter((m) => m.grade || m.size || m.qty)
    .sort((a, b) =>
      `${a.grade}|${a.size}|${a.qty}|${a.unit}`.localeCompare(
        `${b.grade}|${b.size}|${b.qty}|${b.unit}`
      )
    );

  return JSON.stringify({
    customerName: String(customerName || "").toLowerCase().trim(),
    materials: normalizedMaterials,
  });
};

const isClearlyIrrelevantMessage = (message = "") => {
  const text = String(message || "").trim().toLowerCase();

  if (!text || text.length < 3) return true;

  const hasBusinessSignal =
    /\d/.test(text) ||
    /need|required|requirement|stock|rate|quote|quotation|available|dispatch|material|grade|size|dia|round|flat|block|plate|pcs|piece|nos|qty|urgent|chahiye|bhejo|check|dekh|hai kya|milega|maal/i.test(
      text
    );

  if (hasBusinessSignal) return false;

  const ignorePatterns = [
    /^hi$/i,
    /^hello$/i,
    /^hii+$/i,
    /^hey$/i,
    /^ok$/i,
    /^okay$/i,
    /^thanks$/i,
    /^thank you$/i,
    /good morning/i,
    /good night/i,
    /happy birthday/i,
    /congratulations/i,
    /ganpati/i,
    /ganpati bappa/i,
    /mangal murti/i,
    /jai shree ram/i,
    /सुप्रभात/i,
    /शुभ/i,
  ];

  const emojiOnly = /^[\p{Emoji}\s🙏🌺🌹🎉✨❤️]+$/u.test(text);

  if (emojiOnly) return true;

  return ignorePatterns.some((p) => p.test(text));
};

const extractCustomerNameByRegex = (message = "") => {
  const lines = String(message)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const labelled = lines.find((l) =>
    /^(customer|party|company|client)\s*[:\-]/i.test(l)
  );

  if (labelled) {
    return labelled
      .replace(/^(customer|party|company|client)\s*[:\-]/i, "")
      .trim();
  }

  const possible = [...lines].reverse().find((line) =>
    /auto|component|components|industries|industry|pvt|ltd|limited|tools|engineering|forge|forging|gears|faridabad|delhi|gurgaon|noida|manesar/i.test(
      line
    )
  );

  return possible || "";
};

const extractQuantityByRegex = (line = "") => {
  const text = line.toLowerCase();

  const patterns = [
    /(?:qty|quantity)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
    /(?:-|=|:)\s*(\d+(?:\.\d+)?)\s*(?:pcs?|nos?|no|nag|piece|pieces)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(?:pcs?|nos?|no|nag|piece|pieces)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(?:pc|nos|nag)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]) || 0;
  }

  return 0;
};

const extractGradeByRegex = (line = "") => {
  const patterns = [
    /\b(EN8D|EN8|EN9|EN18|EN19C|EN19|EN24|EN31|EN36C|EN36|EN353|EN354|EN100|EN45A|EN45|EN47)\b/i,
    /\b(D2|D3|D6|DB6|OHNS|O1|A2|A8|H11|H13|H10|H21|HCHCR|HSS|M2|M35|M42)\b/i,
    /\b(P20\+?NI|P20NI|P20)\b/i,
    /\b(SS\s*304L|SS\s*304|SS\s*316L|SS\s*316|SS\s*310|SS\s*410|SS\s*420|SS\s*431|17-4PH)\b/i,
    /\b(1\.\d{4})\b/i,
    /\b(42CRMO4|34CRNIMO6|40NICRMO3|100CR6|16MNCR5|20MNCR5|4140|4340|52100|8620|1045|C45|CK45|C40|MS|IS2062)\b/i,
  ];

  for (const p of patterns) {
    const match = line.match(p);
    if (match) return match[1].replace(/\s+/g, "").toUpperCase();
  }

  return "";
};

const extractSizeByRegex = (line = "", grade = "") => {
  let text = String(line);

  if (grade) {
    text = text.replace(
      new RegExp(grade.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      ""
    );
  }

  text = text.replace(
    /qty|quantity|pcs|pc|nos|no|nag|piece|pieces|available|required|need|urgent|stock|check/gi,
    ""
  );

  const diaPatterns = [
    /(?:dia|diameter|ø|round|gol)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*(?:mm)?)?(?:\s*(?:x|\*)\s*(\d+(?:\.\d+)?))?/i,
    /(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:dia|diameter|ø)\b/i,
  ];

  for (const pattern of diaPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) return `dia ${match[1]} x ${match[2]} length`;
      return `dia ${match[1] || match[2]}`;
    }
  }

  const dimMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:x|\*)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|\*)\s*(\d+(?:\.\d+)?))?/i
  );

  if (dimMatch) {
    return dimMatch[3]
      ? `${dimMatch[1]}x${dimMatch[2]}x${dimMatch[3]}`
      : `${dimMatch[1]}x${dimMatch[2]}`;
  }

  return "";
};

const guessTypeFromSizeAndLine = (size = "", line = "") => {
  const text = `${size} ${line}`.toLowerCase();
  const dimensions = String(size).match(/\d+(\.\d+)?/g) || [];

  if (text.includes("dia") || text.includes("round") || text.includes("gol")) {
    return "Round Bar";
  }

  if (text.includes("plate")) return "Plate";
  if (text.includes("flat") || text.includes("patti")) return "Flat Bar";
  if (text.includes("square")) return "Square Bar";

  if (dimensions.length >= 3) return "Block";
  if (dimensions.length === 2) return "Flat Bar";

  return "Other";
};

const splitPossibleMaterialLines = (message = "") => {
  return String(message)
    .replace(/,/g, "\n")
    .replace(/;/g, "\n")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
};

const regexExtractMaterials = async (message = "") => {
  if (isClearlyIrrelevantMessage(message)) {
    return {
      customerName: "",
      materials: [],
      notes: "Ignored irrelevant message",
      confidence: 0,
      enquiryHash: buildEnquiryHash([], ""),
      extractionSource: "ignored",
    };
  }

  const lines = splitPossibleMaterialLines(message);
  const materials = [];

  for (const line of lines) {
    const grade = extractGradeByRegex(line);
    if (!grade) continue;

    const size = extractSizeByRegex(line, grade);
    const quantity = extractQuantityByRegex(line);
    const type = guessTypeFromSizeAndLine(size, line);

    materials.push(
      normalizeMaterial({
        grade,
        type,
        category: "Other",
        size,
        quantity,
        unit: "Nos",
        originalLine: line,
        confidence: 0.7,
      })
    );
  }

  const normalized = await normalizeMaterialsWithGradeMaster(materials);
  const customerName = extractCustomerNameByRegex(message);

  return {
    customerName,
    materials: normalized,
    notes: normalized.length
      ? "Extracted by regex fallback"
      : "No material extracted by regex. Raw query should go to manual review.",
    confidence: normalized.length ? 0.7 : 0,
    enquiryHash: buildEnquiryHash(normalized, customerName),
    extractionSource: normalized.length ? "regex" : "manual_review",
  };
};

const extractMaterialFromText = async (message) => {
  // AI disabled for now. Keep this section for future paid/stable AI.
  /*
  try {
    const aiResult = await extractMaterialFromAI(message);
    if (aiResult.materials?.length) return aiResult;
  } catch (error) {
    console.error("AI failed, using regex:", error.message);
  }
  */

  const regexResult = await regexExtractMaterials(message);

  if (regexResult.materials.length) {
    return regexResult;
  }

  throw new Error("No material extracted. Save raw enquiry as manual_review.");
};

const extractShedAvailabilityByRegex = ({ replyText, materialChecks }) => {
  const text = String(replyText || "").toLowerCase();
  const responses = [];

  for (let index = 0; index < materialChecks.length; index++) {
    const check = materialChecks[index];
    const grade = String(check.grade || "").toLowerCase();
    const requestedSize = String(check.size || "").toLowerCase();
    const lineNo = String(index + 1);

    const related =
      text.includes(grade) ||
      text.includes(lineNo) ||
      text.includes(requestedSize.replace(/\s+/g, ""));

    if (!related) continue;

    let status = "unclear";
    let availableSize = "";
    let availableQuantity = 0;
    let remark = "Regex parsed shed reply";

    const qtyMatch = text.match(
      /(\d+(?:\.\d+)?)\s*(?:pc|pcs|nos|no|nag|piece|pieces)/i
    );

    if (qtyMatch) availableQuantity = Number(qtyMatch[1]) || 0;

    const diaMatch = text.match(
      /(\d+(?:\.\d+)?)\s*(?:dia|diameter)|(?:dia|diameter)\s*(\d+(?:\.\d+)?)/i
    );

    if (diaMatch) availableSize = `dia ${diaMatch[1] || diaMatch[2]}`;

    const dimMatch = text.match(
      /(\d+(?:\.\d+)?)\s*(?:x|\*)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|\*)\s*(\d+(?:\.\d+)?))?/i
    );

    if (dimMatch) {
      availableSize = dimMatch[3]
        ? `${dimMatch[1]}x${dimMatch[2]}x${dimMatch[3]}`
        : `${dimMatch[1]}x${dimMatch[2]}`;
    }

    if (/nahi|nahin|na hai|stock nahi|not available|no stock/.test(text)) {
      status = "not_available";
      remark = "Regex detected not available";
    }

    if (/hai|available|pada hai|mil jayega|mil jaega|ok/.test(text)) {
      status = "exact_available";
      remark = "Regex detected available";
    }

    if (availableSize && normalizeSize(availableSize) !== normalizeSize(check.size)) {
      status = "near_available";
      remark = "Regex detected alternate size";
    }

    if (
      availableQuantity > 0 &&
      Number(check.requiredQuantity || 0) > 0 &&
      availableQuantity < Number(check.requiredQuantity)
    ) {
      status =
        availableSize && normalizeSize(availableSize) !== normalizeSize(check.size)
          ? "near_available"
          : "partial_available";
      remark = "Regex detected partial quantity";
    }

    responses.push({
      lineNo: index + 1,
      checkId: String(check._id),
      status,
      availableSize,
      availableQuantity,
      unit: "Nos",
      remark,
      confidence: 0.55,
    });
  }

  return {
    responses,
    overallConfidence: responses.length ? 0.55 : 0,
    extractionSource: responses.length ? "regex" : "manual_review",
  };
};

const extractShedAvailabilityFromReply = async ({ replyText, materialChecks }) => {
  // AI disabled for now. Keep for future.
  /*
  try {
    const aiResult = await extractShedAvailabilityFromAI({ replyText, materialChecks });
    if (aiResult.responses?.length) return aiResult;
  } catch (error) {
    console.error("Shed AI failed, using regex:", error.message);
  }
  */

  const regexResult = extractShedAvailabilityByRegex({
    replyText,
    materialChecks,
  });

  if (regexResult.responses.length) {
    return regexResult;
  }

  throw new Error("Shed reply could not be parsed. Mark unclear/manual review.");
};

const classifyIncomingWhatsappMessage = async (message) => {
  if (isClearlyIrrelevantMessage(message)) {
    return {
      intent: "irrelevant",
      confidence: 0.9,
      reason: "Regex ignored greeting/status/non-business message",
    };
  }

  const text = String(message || "").toLowerCase();

  if (/hai|available|pada hai|nahi|stock nahi|mil jayega|mil jaega/.test(text)) {
    return {
      intent: "availability_reply",
      confidence: 0.65,
      reason: "Regex detected availability style message",
    };
  }

  return {
    intent: "new_enquiry",
    confidence: 0.6,
    reason: "Regex allowed message for enquiry buffer",
  };
};

module.exports = {
  extractMaterialFromText,
  buildEnquiryHash,
  extractShedAvailabilityFromReply,
  classifyIncomingWhatsappMessage,
};