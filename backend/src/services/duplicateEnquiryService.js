const Enquiry = require("../models/Enquiry");
const { buildEnquiryHash } = require("./aiExtractionService");

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

const findDuplicateEnquiry = async ({ materials, customerName, customerPhone }) => {
  const enquiryHash = buildEnquiryHash(materials, customerName);

  const fromDate = new Date(Date.now() - TEN_DAYS_MS);

  const duplicate = await Enquiry.findOne({
    enquiryHash,
    createdAt: { $gte: fromDate },
    status: {
      $nin: ["closed"],
    },
  }).sort({ createdAt: -1 });

  return {
    isDuplicate: !!duplicate,
    duplicate,
    enquiryHash,
  };
};

module.exports = {
  findDuplicateEnquiry,
};