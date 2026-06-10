const Shed = require("../models/Shed");

const assignShedByCategory = async (category) => {
  const shed = await Shed.findOne({
    isActive: true,
    materialCategories: category,
  }).sort({ priority: 1 });

  return shed;
};

module.exports = {
  assignShedByCategory,
};