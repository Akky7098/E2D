const MaterialCheck = require("../models/MaterialCheck");
const Enquiry = require("../models/Enquiry");

const allowedStatuses = [
  "exact_available",
  "near_available",
  "partial_available",
  "not_available",
  "unclear",
];

const mapMaterialCheckStatus = (availabilityStatus) => {
  if (availabilityStatus === "exact_available") return "available";
  return availabilityStatus;
};

const updateMaterialAvailability = async ({
  materialCheckId,
  availabilityStatus,
  availableSize,
  availableQuantity,
  remark,
  audioFile,
  user,
}) => {
  if (!allowedStatuses.includes(availabilityStatus)) {
    throw new Error("Invalid availability status");
  }

  const check = await MaterialCheck.findById(materialCheckId);

  if (!check) {
    throw new Error("Material check not found");
  }

  check.status = mapMaterialCheckStatus(availabilityStatus);

  check.availability = {
    status: availabilityStatus,
    availableSize: availableSize || "",
    availableQuantity: Number(availableQuantity) || 0,
    unit: check.unit || "Nos",
    remark: remark || "",
    rawReply: remark || "",
    updatedAt: new Date(),
  };

  check.updateSource = "frontend";

  if (user) {
    check.updatedBy = user._id;
    check.updatedByName = user.name;
    check.updatedByRole = user.role;
  }

  if (audioFile) {
    check.audioAttachment = {
  fileName: audioFile.filename,
  filePath: `/uploads/${audioFile.filename}`,
  originalName: audioFile.originalname,
};
  }

  check.responseHistory.push({
    response: availabilityStatus,
    responseBy: user?.name || "system_user",
    responseAt: new Date(),
    message: remark || "Updated from E2D app",
  });

  await check.save();

  await updateEnquiryStatus(check.enquiryId);

  return check;
};

const updateEnquiryStatus = async (enquiryId) => {
  const checks = await MaterialCheck.find({ enquiryId });

  if (!checks.length) return;

  const statuses = checks.map((c) => c.availability?.status || c.status);

  let enquiryStatus = "pending_material_check";

  if (
    statuses.every((s) => s === "exact_available" || s === "available")
  ) {
    enquiryStatus = "available";
  } else if (statuses.every((s) => s === "not_available")) {
    enquiryStatus = "not_available";
  } else if (
    statuses.some((s) =>
      ["exact_available", "available", "partial_available", "near_available"].includes(s)
    )
  ) {
    enquiryStatus = "partial_available";
  }

  await Enquiry.findByIdAndUpdate(enquiryId, {
    status: enquiryStatus,
  });
};

module.exports = {
  updateMaterialAvailability,
  updateEnquiryStatus,
};