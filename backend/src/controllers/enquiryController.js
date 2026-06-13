const Enquiry = require("../models/Enquiry");
const MaterialCheck = require("../models/MaterialCheck");
const Shed = require("../models/Shed");
const { assignShedByCategory } = require("../services/materialAssignmentService");
const { sendWhatsappMessage } = require("../services/whatsappService");
const productGrades = require("../utils/productGrades");

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeMaterialLine = (line = {}) => {
  return {
    grade: line.grade || line.otherGrade || "",
    otherGrade: line.otherGrade || "",
    shape: line.shape || "round",
    category: line.category || "other",
    size: line.size || "",
    quantity: Number(line.quantity) || 0,
    unit: line.unit || "Nos",
    manualShedIds: Array.isArray(line.manualShedIds) ? line.manualShedIds : [],
  };
};

const sendMaterialCheckToShed = async ({ enquiry, material, shed, lineNo }) => {
  const materialCheck = await MaterialCheck.create({
    enquiryId: enquiry._id,
    lineNo,
    assignedShed: shed._id,
    assignedWhatsappNumber: shed.whatsappNumber,

    grade: material.grade,
    type: material.shape,
    category: material.category,
    size: material.size,
    requiredQuantity: material.quantity,
    unit: material.unit,

    status: "pending",
    availability: {
      status: "pending",
    },
  });

  if (shed.whatsappNumber) {
    await sendWhatsappMessage(
      shed.whatsappNumber,
      `New Material Check Request

Enquiry: ${enquiry.enquiryNo}
Customer: ${enquiry.customerName || "-"}
Line: ${lineNo}

Grade: ${material.grade || "-"}
Type: ${material.materialType || "-"}
Category: ${material.category || "-"}
Size: ${material.size || "-"}
Qty: ${material.quantity || 0} ${material.unit || "Nos"}

Please reply naturally:
Available / Partial / Not Available with size, quantity and remark.`
    );
  }

  return materialCheck._id;
};

const createManualEnquiry = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      makeOrigin = "india_make",
      rawMessage = "",
      materials = [],
    } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one material line is required",
      });
    }

    const cleanMaterials = materials
      .map(normalizeMaterialLine)
      .filter((m) => m.grade || m.size);

    if (cleanMaterials.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add valid material grade/size",
      });
    }

    const enquiry = await Enquiry.create({
      source: "manual",
      makeOrigin,
      customerName: customerName.trim(),
      customerPhone,
      rawMessage,

      createdBy: req.user._id,
      createdByName: req.user.name,
      createdByRole: req.user.role,

      extractedMaterial: cleanMaterials[0],
      materials: cleanMaterials,

      status: "pending_material_check",
    });

    const allMaterialCheckIds = [];

    for (let index = 0; index < cleanMaterials.length; index++) {
      const material = cleanMaterials[index];
      const lineNo = index + 1;

      let sheds = [];

      if (material.manualShedIds.length > 0) {
        sheds = await Shed.find({
          _id: { $in: material.manualShedIds },
          isActive: true,
        }).sort({ priority: 1 });
      } else {
        const autoShed = await assignShedByCategory(material.category);
        if (autoShed) sheds = [autoShed];
      }

      for (const shed of sheds) {
        const materialCheckId = await sendMaterialCheckToShed({
          enquiry,
          material,
          shed,
          lineNo,
        });

        allMaterialCheckIds.push(materialCheckId);
      }
    }

    enquiry.materialCheckIds = allMaterialCheckIds;
    enquiry.materialCheckId = allMaterialCheckIds[0] || null;

    if (allMaterialCheckIds.length === 0) {
      enquiry.status = "escalated";
    }

    await enquiry.save();

    return res.status(201).json({
      success: true,
      message:
        allMaterialCheckIds.length > 0
          ? "Enquiry created and sent to shed"
          : "Enquiry created but no shed mapping found",
      data: enquiry,
    });
  } catch (error) {
    console.error("Create manual enquiry error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getEnquiries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      search = "",
      status,
      source,
      makeOrigin,
      category,
      grade,
    } = req.query;

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Number(limit) || 30, 100);

    const filter = {};

    if (req.user.role === "sales") {
      filter.createdBy = req.user._id;
    }

    if (req.user.role === "supervisor") {
      filter.assignedSupervisor = req.user._id;
    }

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (makeOrigin) filter.makeOrigin = makeOrigin;
    if (category) filter["materials.category"] = category;
    if (grade) filter["materials.grade"] = grade;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { enquiryNo: regex },
        { customerName: regex },
        { customerPhone: regex },
        { rawMessage: regex },
        { "materials.grade": regex },
        { "materials.size": regex },
        { "materials.materialType": regex },
      ];
    }

    const total = await Enquiry.countDocuments(filter);

    const enquiries = await Enquiry.find(filter)
  .populate({
    path: "materialCheckIds",
    select:
      "lineNo status availability audioAttachment updatedByName updatedByRole updateSource updatedAt",
  })
  .populate({
    path: "materialCheckId",
    select:
      "lineNo status availability audioAttachment updatedByName updatedByRole updateSource updatedAt",
  })
  .populate("createdBy", "name email role")
  .sort({ createdAt: -1 })
  .skip((safePage - 1) * safeLimit)
  .limit(safeLimit);
  
    return res.json({
      success: true,
      data: {
        enquiries,
        pagination: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
        },
      },
    });
  } catch (error) {
    console.error("Get enquiries error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id)
      .populate("materialCheckIds")
      .populate("materialCheckId")
      .populate("createdBy", "name email role");

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    return res.json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error("Get enquiry by id error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProductGrades = async (req, res) => {
  return res.json({
    success: true,
    data: productGrades,
  });
};

const getActiveSheds = async (req, res) => {
  try {
    const sheds = await Shed.find({ isActive: true }).sort({ priority: 1 });

    return res.json({
      success: true,
      data: sheds,
    });
  } catch (error) {
    console.error("Get active sheds error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createManualEnquiry,
  getEnquiries,
  getEnquiryById,
  getProductGrades,
  getActiveSheds,
};