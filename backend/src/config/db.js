const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("MONGO URI EXISTS:", !!process.env.MONGO_URI);

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error);
    process.exit(1);
  }
};

mongoose.connection.on("connected", () => {
  console.log("MongoDB connection event: connected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection event: error");
  console.error(err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB connection event: disconnected");
});

module.exports = connectDB;