require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({
    email: "akky8283@gmail.com",
  });

  if (existing) {
    console.log("Super admin already exists");
    process.exit();
  }

  await User.create({
    name: "Super Admin",
    email: "akky8283@gmail.com",
    mobile: "9305127159",
    whatsappNumber: "9305127159@c.us",
    password: "123456",
    role: "super_admin",
  });

  console.log("Super admin created");
  process.exit();
};

run();