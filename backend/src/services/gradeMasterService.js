const GradeMaster = require("../models/GradeMaster");

const normalizeText = (value = "") => {
  return String(value)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/DIN/g, "")
    .replace(/SAE/g, "")
    .trim();
};

const normalizeGradeFromMaster = async (grade = "") => {
  const clean = normalizeText(grade);

  if (!clean) {
    return {
      standardGrade: "",
      category: "Other",
      matchedAlias: "",
    };
  }

  const gradeDoc = await GradeMaster.findOne({
    isActive: true,
    $or: [
      { standardGrade: clean },
      { aliases: clean },
    ],
  });

  if (!gradeDoc) {
    return {
      standardGrade: grade.toUpperCase().trim(),
      category: "Other",
      matchedAlias: "",
    };
  }

  return {
    standardGrade: gradeDoc.standardGrade,
    category: gradeDoc.category,
    matchedAlias: clean,
  };
};

const normalizeMaterialsWithGradeMaster = async (materials = []) => {
  const result = [];

  for (const material of materials) {
    const gradeInfo = await normalizeGradeFromMaster(material.grade);

    result.push({
      ...material,
      grade: gradeInfo.standardGrade || material.grade,
      category: gradeInfo.category || material.category || "Other",
      matchedAlias: gradeInfo.matchedAlias,
    });
  }

  return result;
};

module.exports = {
  normalizeGradeFromMaster,
  normalizeMaterialsWithGradeMaster,
};