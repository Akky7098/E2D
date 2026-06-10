const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const enquiryRoutes = require("./routes/enquiryRoutes");
const materialCheckRoutes = require("./routes/materialCheckRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");



const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/material-checks", materialCheckRoutes);

app.get("/", (req, res) => {
  res.send("E2D Backend Running");
});

module.exports = app;