const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const {
  normalizeMaterialsWithGradeMaster,
} = require("./gradeMasterService");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeJsonParse = (text) => {
  try {
    const cleaned = String(text || "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) return null;

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    console.error("AI JSON parse failed:", text);
    return null;
  }
};

const callGeminiWithTimeout = async (prompt, timeoutMs = 25000) => {
  return Promise.race([
    ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), timeoutMs)
    ),
  ]);
};

const getAIText = (response) => response?.text || "";

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

const extractMaterialFromAI = async (message = "") => {
  const prompt = `
You are an expert steel enquiry extraction assistant for Bharat Special Steels style business.

Return ONLY valid JSON. No markdown. No explanation.

JSON schema:
{
  "customerName": "",
  "materials": [
    {
      "grade": "",
      "type": "",
      "category": "Other",
      "size": "",
      "quantity": 0,
      "unit": "Nos",
      "originalLine": "",
      "confidence": 0
    }
  ],
  "notes": "",
  "confidence": 0
}

Rules:
1. Extract ALL material requirements.
2. Never return only first grade.
3. One grade + one size + one quantity = one object.
4. If same grade has multiple sizes, return separate objects.
5. If quantity missing, quantity = 0.
6. pc, pcs, nos, no, nag, piece, pieces = unit Nos.
7. dia, diameter, ø, round, gol = type Round Bar.
8. 200x200x500 / 250 x 250 x 700 / 300*200*600 = type Block.
9. flat, patti, 200x50, 75x25 = type Flat Bar.
10. plate = type Plate.
11. square or 200x200 without length = Square Bar unless block is clearly written.
12. Do not invent missing grade or customer name.
13. Ignore greetings like sir, bhai, please, thanks.
14. Extract customer name if Customer, Party, Company is mentioned or last line looks like company name.
15. If grade is 1.2379, 1.2344, 1.2311, 4140, 4340, extract exactly.

Message:
${message}
`;

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await callGeminiWithTimeout(prompt, 25000);
      const parsed = safeJsonParse(getAIText(response));

      if (!parsed || !Array.isArray(parsed.materials)) {
        throw new Error("Invalid Gemini JSON");
      }

      let materials = parsed.materials
        .map(normalizeMaterial)
        .filter((m) => m.grade || m.size || m.quantity);

      materials = await normalizeMaterialsWithGradeMaster(materials);

      if (!materials.length) {
        throw new Error("Gemini returned empty materials");
      }

      const customerName = String(parsed.customerName || "").trim();

      return {
        customerName,
        materials,
        notes: String(parsed.notes || "").trim(),
        confidence: Number(parsed.confidence) || 0.85,
        enquiryHash: buildEnquiryHash(materials, customerName),
        extractionSource: "ai",
      };
    } catch (error) {
      lastError = error;
      console.error(`Gemini material attempt ${attempt} failed:`, error.message);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }

  throw lastError;
};

const extractMaterialFromText = async (message) => {
  try {
    const aiResult = await extractMaterialFromAI(message);

    if (aiResult.materials?.length) {
      return aiResult;
    }
  } catch (error) {
    console.error("Gemini failed, using regex fallback:", error.message);
  }

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

const extractShedAvailabilityFromAI = async ({ replyText, materialChecks }) => {
  const itemsText = materialChecks
    .map((c, index) => {
      return `${index + 1}. checkId=${c._id}
Grade: ${c.grade}
Type: ${c.type}
Requested Size: ${c.size}
Requested Qty: ${c.requiredQuantity} ${c.unit || "Nos"}`;
    })
    .join("\n\n");

  const prompt = `
You are extracting steel shed/store availability reply.

Return ONLY valid JSON. No markdown.

JSON schema:
{
  "responses": [
    {
      "lineNo": 1,
      "checkId": "",
      "status": "",
      "availableSize": "",
      "availableQuantity": 0,
      "unit": "Nos",
      "remark": "",
      "confidence": 0
    }
  ],
  "overallConfidence": 0
}

Allowed status:
- exact_available
- near_available
- partial_available
- not_available
- unclear

Rules:
1. Match reply to requested items using line number, grade, size, context.
2. Exact size and full quantity available = exact_available.
3. Alternate close size = near_available.
4. Same size but lower quantity = partial_available.
5. nahi, stock nahi, not available = not_available.
6. hai, pada hai, available, mil jayega = available.
7. Do not update item not mentioned unless reply says all available/all not available.

Requested Items:
${itemsText}

Shed Reply:
${replyText}
`;

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await callGeminiWithTimeout(prompt, 20000);
      const parsed = safeJsonParse(getAIText(response));

      if (!parsed || !Array.isArray(parsed.responses)) {
        throw new Error("Invalid Gemini shed JSON");
      }

      return {
        responses: parsed.responses.map((r) => ({
          lineNo: Number(r.lineNo) || 0,
          checkId: String(r.checkId || ""),
          status: String(r.status || "unclear"),
          availableSize: String(r.availableSize || ""),
          availableQuantity: Number(r.availableQuantity) || 0,
          unit: String(r.unit || "Nos"),
          remark: String(r.remark || ""),
          confidence: Number(r.confidence) || 0,
        })),
        overallConfidence: Number(parsed.overallConfidence) || 0,
        extractionSource: "ai",
      };
    } catch (error) {
      lastError = error;
      console.error(`Gemini shed attempt ${attempt} failed:`, error.message);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }

  throw lastError;
};

const extractShedAvailabilityFromReply = async ({ replyText, materialChecks }) => {
  try {
    const aiResult = await extractShedAvailabilityFromAI({
      replyText,
      materialChecks,
    });

    if (aiResult.responses?.length) return aiResult;
  } catch (error) {
    console.error("Gemini shed failed, using regex fallback:", error.message);
  }

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