require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const { initWhatsapp } = require("./src/services/whatsappService");
const {
  startMaterialEscalationCron,
} = require("./src/jobs/materialEscalationCron");
const {
  startWhatsappBufferCron,
} = require("./src/jobs/whatsappBufferCron");

const PORT = process.env.PORT || 5000;

/* ================= HEALTH CHECK ================= */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    application: "E2D Backend",
    status: "Running",
    timestamp: new Date(),
  });
});

/* ================= START SERVER ================= */

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, async () => {
      console.log(`E2D backend running on port ${PORT}`);

      //await initWhatsapp();
      startWhatsappBufferCron();
      startMaterialEscalationCron();
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();