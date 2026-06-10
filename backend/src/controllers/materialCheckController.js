const MaterialCheck = require("../models/MaterialCheck");

const getMaterialChecks = async (req, res) => {
  try {
    const checks = await MaterialCheck.find()
      .populate("enquiryId")
      .populate("assignedShed")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: checks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPendingMaterialChecks = async (req, res) => {
  try {
    const checks = await MaterialCheck.find({
      status: { $in: ["pending", "waiting_partial_quantity", "escalated"] },
    })
      .populate("enquiryId")
      .populate("assignedShed")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: checks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getMaterialChecks,
  getPendingMaterialChecks,
};