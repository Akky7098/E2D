require("dotenv").config();
const mongoose = require("mongoose");
const Shed = require("./src/models/Shed");
const User = require("./src/models/User");

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    await Shed.deleteMany({});
    await User.deleteMany({ role: "shed_user" });

    const shed1 = await Shed.create({
      name: "Shed 1 - Alloy Steel",
      materialCategories: ["Alloy Steel", "Carbon Steel"],
      contactPerson: "Shed Person 1",
      whatsappNumber: "919795261616@c.us",
      isActive: true,
      priority: 1,
    });

    const shed2 = await Shed.create({
      name: "Shed 2 - Tool Steel",
      materialCategories: ["Tool Steel", "Plastic Mould Steel"],
      contactPerson: "Shed Person 2",
      whatsappNumber: "919999999992@c.us",
      isActive: true,
      priority: 1,
    });

    const shed3 = await Shed.create({
      name: "Shed 3 - Stainless Steel",
      materialCategories: ["Stainless Steel"],
      contactPerson: "Shed Person 3",
      whatsappNumber: "919999999993@c.us",
      isActive: true,
      priority: 1,
    });

    await User.create([
      {
        name: "Shed Person 1",
        email: "shed1@e2d.com",
        mobile: "9999999991",
        whatsappNumber: "919999999991@c.us",
        password: "123456",
        role: "shed_user",
        assignedShed: shed1._id,
      },
      {
        name: "Shed Person 2",
        email: "shed2@e2d.com",
        mobile: "9999999992",
        whatsappNumber: "919999999992@c.us",
        password: "123456",
        role: "shed_user",
        assignedShed: shed2._id,
      },
      {
        name: "Shed Person 3",
        email: "shed3@e2d.com",
        mobile: "9999999993",
        whatsappNumber: "919999999993@c.us",
        password: "123456",
        role: "shed_user",
        assignedShed: shed3._id,
      },
    ]);

    console.log("Sheds and shed users seeded successfully");
    process.exit();
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
};

run();