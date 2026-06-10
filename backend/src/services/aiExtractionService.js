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
  } catch {
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

const normalizeMaterial = (material = {}) => {
  return {
    grade: String(material.grade || "").trim().toUpperCase(),
    type: String(material.type || material.materialType || "Other").trim(),
    category: String(material.category || "Other").trim(),
    size: String(material.size || "").trim(),
    quantity: Number(material.quantity) || 0,
    unit: String(material.unit || "Nos").trim(),
    originalLine: String(material.originalLine || "").trim(),
    confidence: Number(material.confidence) || 0,
  };
};

const buildEnquiryHash = (materials = [], customerName = "") => {
  const normalizedMaterials = materials
    .map((m) => ({
      grade: String(m.grade || "").toUpperCase().trim(),
      size: normalizeSize(m.size),
      qty: Number(m.quantity) || 0,
      unit: String(m.unit || "Nos").toLowerCase().trim(),
    }))
    .filter((m) => m.grade || m.size || m.qty)
    .sort((a, b) => {
      const x = `${a.grade}|${a.size}|${a.qty}|${a.unit}`;
      const y = `${b.grade}|${b.size}|${b.qty}|${b.unit}`;
      return x.localeCompare(y);
    });

  return JSON.stringify({
    customerName: String(customerName || "").toLowerCase().trim(),
    materials: normalizedMaterials,
  });
};

const guessTypeFromSizeAndLine = (size = "", line = "") => {
  const text = `${size} ${line}`.toLowerCase();

  if (text.includes("dia") || text.includes("round") || text.includes("gol")) {
    return "Round Bar";
  }

  if (text.includes("flat") || text.includes("patti")) {
    return "Flat Bar";
  }

  if (text.includes("plate")) {
    return "Plate";
  }

  const dimensions = String(size).match(/\d+(\.\d+)?/g) || [];

  if (dimensions.length >= 3) return "Block";
  if (dimensions.length === 2) return "Flat Bar";

  if (text.includes("square")) return "Square Bar";

  return "Other";
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
    return labelled.replace(/^(customer|party|company|client)\s*[:\-]/i, "").trim();
  }

  const last = lines[lines.length - 1] || "";

  if (
    /auto|components|industries|pvt|ltd|limited|tools|engineering|faridabad|delhi|gurgaon|noida/i.test(
      last
    )
  ) {
    return last;
  }

  return "";
};

const extractQuantityByRegex = (line = "") => {
  const text = line.toLowerCase();

  const patterns = [
    /(?:qty|quantity)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
    /(?:-|=|:)\s*(\d+(?:\.\d+)?)\s*(?:pcs?|nos?|no|nag|piece|pieces)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(?:pcs?|nos?|no|nag|piece|pieces)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]) || 0;
  }

  return 0;
};

const extractSizeByRegex = (line = "", grade = "") => {
  let text = line;

  if (grade) {
    text = text.replace(new RegExp(grade.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
  }

  text = text.replace(/qty|quantity|pcs|pc|nos|no|nag|piece|pieces/gi, "");

  const diaPatterns = [
    /(?:dia|diameter|ø|round|gol)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*(?:mm)?)?(?:\s*x\s*(\d+(?:\.\d+)?))?/i,
    /(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:dia|diameter|ø)\b/i,
  ];

  for (const pattern of diaPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) return `dia ${match[1]} x ${match[2]} length`;
      return `dia ${match[1]}`;
    }
  }

  const dimensionMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:x|\*)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|\*)\s*(\d+(?:\.\d+)?))?/i
  );

  if (dimensionMatch) {
    return dimensionMatch[3]
      ? `${dimensionMatch[1]}x${dimensionMatch[2]}x${dimensionMatch[3]}`
      : `${dimensionMatch[1]}x${dimensionMatch[2]}`;
  }

  return "";
};

const extractGradeByRegex = (line = "") => {
  const gradePatterns = [
    /\b(?:EN\s*)?(EN8D|EN8|EN9|EN18|EN19C|EN19|EN24|EN31|EN36C|EN36|EN353|EN354|EN100|EN45A|EN45|EN47)\b/i,
    /\b(D2|D3|D6|DB6|OHNS|O1|A2|A8|H11|H13|H10|H21|HCHCR|HSS|M2|M35|M42)\b/i,
    /\b(P20\+?NI|P20NI|P20)\b/i,
    /\b(SS\s*304L|SS\s*304|SS\s*316L|SS\s*316|SS\s*310|SS\s*410|SS\s*420|SS\s*431|17-4PH)\b/i,
    /\b(1\.\d{4})\b/i,
    /\b(42CRMO4|34CRNIMO6|40NICRMO3|100CR6|16MNCR5|20MNCR5|4140|4340|52100|8620|1045|C45|CK45|C40|MS|IS2062)\b/i,
  ];

  for (const pattern of gradePatterns) {
    const match = line.match(pattern);
    if (match) return match[1].replace(/\s+/g, "").toUpperCase();
  }

  return "";
};

const regexExtractMaterials = async (message = "") => {
  const lines = String(message)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const materials = [];

  for (const line of lines) {
    const grade = extractGradeByRegex(line);
    if (!grade) continue;

    const size = extractSizeByRegex(line, grade);
    const quantity = extractQuantityByRegex(line);
    const type = guessTypeFromSizeAndLine(size, line);

    materials.push({
      grade,
      type,
      category: "Other",
      size,
      quantity,
      unit: "Nos",
      originalLine: line,
      confidence: 0.65,
    });
  }

  const normalized = await normalizeMaterialsWithGradeMaster(materials);

  return {
    customerName: extractCustomerNameByRegex(message),
    materials: normalized,
    notes: "Extracted by regex fallback",
    confidence: normalized.length ? 0.65 : 0,
    enquiryHash: buildEnquiryHash(normalized, extractCustomerNameByRegex(message)),
    extractionSource: "regex",
  };
};

const extractMaterialFromText = async (message) => {
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

Important:
- Backend GradeMaster will normalize grade and category later.
- Do not overthink category. Use "Other" if unsure.
- Main job: extract grade, type, size, quantity, unit, customerName.

Rules:
1. Extract ALL material requirements.
2. Never return only first grade.
3. One grade + one size + one quantity = one material object.
4. Same grade with different sizes = separate objects.
5. If quantity is missing, quantity = 0.
6. pcs, pc, nos, no, nag, piece, pieces, qty = unit "Nos".
7. dia, diameter, ø, round, gol = type "Round Bar".
8. 200x200x500 / 250 x 250 x 700 / 300*200*600 = type "Block".
9. flat, patti, 200x50, 75x25 = type "Flat Bar".
10. plate = type "Plate".
11. square or 200x200 without length = type "Square Bar" unless block is clearly written.
12. Preserve size text like "dia 90", "90 dia", "250x250x700".
13. Do not invent missing grade or customer name.
14. Ignore greetings like sir, bhai, pls, please, thanks.
15. Extract customer name if message has Customer, Party, Company, or last line looks like company name.
16. If grade is 1.2379, 1.2344, 1.2311, 4340, 4140, extract it exactly.

Allowed type values:
- Round Bar
- Flat Bar
- Plate
- Block
- Square Bar
- Other

Message:
${message}
`;

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await callGeminiWithTimeout(prompt, 25000);
      const parsed = safeJsonParse(getAIText(response));

      if (!parsed || !Array.isArray(parsed.materials)) {
        throw new Error("Invalid AI JSON format");
      }

      let materials = parsed.materials.map(normalizeMaterial).filter((m) => {
        return m.grade || m.size || m.quantity;
      });

      materials = await normalizeMaterialsWithGradeMaster(materials);

      if (!materials.length) {
        throw new Error("AI returned empty materials array");
      }

      const customerName = String(parsed.customerName || "").trim();

      return {
        customerName,
        materials,
        notes: String(parsed.notes || "").trim(),
        confidence: Number(parsed.confidence) || 0,
        enquiryHash: buildEnquiryHash(materials, customerName),
        extractionSource: "ai",
      };
    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt} failed:`, error.message);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }

  console.error("AI failed. Trying regex fallback:", lastError.message);

  const regexResult = await regexExtractMaterials(message);

  if (regexResult.materials.length) {
    return regexResult;
  }

  throw new Error(`AI and regex extraction failed: ${lastError.message}`);
};

const extractShedAvailabilityByRegex = ({ replyText, materialChecks }) => {
  const text = String(replyText || "").toLowerCase();
  const responses = [];

  for (let index = 0; index < materialChecks.length; index++) {
    const check = materialChecks[index];
    const grade = String(check.grade || "").toLowerCase();
    const requestedSize = String(check.size || "").toLowerCase();

    const related =
      text.includes(grade) ||
      text.includes(String(index + 1)) ||
      text.includes(requestedSize.replace(/\s+/g, ""));

    if (!related) continue;

    let status = "unclear";
    let availableSize = "";
    let availableQuantity = 0;
    let remark = "";

    const qtyMatch = text.match(
      new RegExp(`(?:${grade}.*?)(\\d+(?:\\.\\d+)?)\\s*(?:pc|pcs|nos|no|nag|piece|pieces)`, "i")
    );

    if (qtyMatch) {
      availableQuantity = Number(qtyMatch[1]) || 0;
    }

    const diaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:dia|diameter)|(?:dia|diameter)\s*(\d+(?:\.\d+)?)/i);
    if (diaMatch) {
      availableSize = `dia ${diaMatch[1] || diaMatch[2]}`;
    }

    const dimMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:x|\*)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|\*)\s*(\d+(?:\.\d+)?))?/i);
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
      status = availableSize && normalizeSize(availableSize) !== normalizeSize(check.size)
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
    extractionSource: "regex",
  };
};

const extractShedAvailabilityFromReply = async ({ replyText, materialChecks }) => {
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

Return ONLY valid JSON. No markdown. No explanation.

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
1. Match reply to requested items using line number, grade, size, and context.
2. Exact requested size and full quantity available = exact_available.
3. Close alternate size available = near_available.
4. Same size but lower quantity = partial_available.
5. nahi, stock nahi, not available, na = not_available.
6. hai, pada hai, available, mil jayega = available.
7. Capture available alternative size in availableSize.
8. Capture quantity like 2 pc, 1 nag, ek piece.
9. Do not update items not mentioned unless reply clearly says all available or all not available.
10. If unclear, status = unclear.

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
        throw new Error("Invalid shed reply JSON");
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
      console.error(`Shed reply AI attempt ${attempt} failed:`, error.message);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }

  console.error("Shed reply AI failed. Trying regex fallback:", lastError.message);

  const regexResult = extractShedAvailabilityByRegex({
    replyText,
    materialChecks,
  });

  if (regexResult.responses.length) {
    return regexResult;
  }

  throw new Error(`AI and regex shed reply extraction failed: ${lastError.message}`);
};

const classifyIncomingWhatsappMessage = async (message) => {
  const prompt = `
Classify this WhatsApp message for a steel business.

Return ONLY valid JSON.

Schema:
{
  "intent": "",
  "confidence": 0,
  "reason": ""
}

Allowed intent:
- new_enquiry
- availability_reply
- irrelevant
- unclear

new_enquiry: customer/sales asking material, stock, rate, dispatch, quotation, requirement.
availability_reply: shed/store replying about stock availability.
irrelevant: greeting, festival, joke, personal, non-business.
unclear: not enough context.

Message:
${message}
`;

  try {
    const response = await callGeminiWithTimeout(prompt, 12000);
    const parsed = safeJsonParse(getAIText(response));

    return {
      intent: parsed?.intent || "unclear",
      confidence: Number(parsed?.confidence) || 0,
      reason: parsed?.reason || "",
    };
  } catch (error) {
    console.error("Message classification failed:", error.message);

    return {
      intent: "unclear",
      confidence: 0,
      reason: error.message,
    };
  }
};

module.exports = {
  extractMaterialFromText,
  buildEnquiryHash,
  extractShedAvailabilityFromReply,
  classifyIncomingWhatsappMessage,
};