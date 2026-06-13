const MaterialCheck = require("../models/MaterialCheck");

const {
  updateMaterialAvailability,
} = require("../services/materialCheckUpdateService");

const getMaterialChecks = async (req, res) => {
  try {
    const checks = await MaterialCheck.find()
      .populate("enquiryId")
      .populate("assignedShed")
      .populate("updatedBy")
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
      status: { $in: ["pending", "unclear", "escalated"] },
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

const updateMaterialCheck = async (req, res) => {
  try {
    const check = await updateMaterialAvailability({
      materialCheckId: req.params.id,
      availabilityStatus: req.body.availabilityStatus,
      availableSize: req.body.availableSize,
      availableQuantity: req.body.availableQuantity,
      remark: req.body.remark,
      audioFile: req.file,
      user: req.user,
    });

    res.json({
      success: true,
      message: "Material availability updated successfully",
      data: check,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getMaterialChecks,
  getPendingMaterialChecks,
  updateMaterialCheck,
};