require("dotenv").config();

const http = require("http");

const app = require("./src/app");
const connectDB = require("./src/config/db");

const ensureChromium = require("./src/utils/ensureChromium");
const { initWhatsapp } = require("./src/services/whatsappService");

const startWhatsappHealthCron = require("./src/jobs/whatsappHealthCron");
const { startMaterialEscalationCron } = require("./src/jobs/materialEscalationCron");

const PORT = process.env.PORT || 5000;

let booted = false;

const startApp = async () => {
  if (booted) {
    console.log("App already booted. Skipping duplicate init.");
    return;
  }

  booted = true;

  await connectDB();

  const server = http.createServer(app);

  server.listen(PORT, async () => {
    console.log(`E2D backend running on port ${PORT}`);

    if (process.env.ENABLE_BACKGROUND_JOBS === "true") {
      console.log("Starting E2D background jobs...");

      try {
        await ensureChromium();
      } catch (error) {
        console.log("Chromium setup failed:", error.message);
      }

      try {
        await initWhatsapp();
      } catch (error) {
        console.log("WhatsApp startup failed:", error.message);
      }

      try {
        startWhatsappHealthCron();
      } catch (error) {
        console.log("WhatsApp health cron failed to start:", error.message);
      }

      try {
        startMaterialEscalationCron();
      } catch (error) {
        console.log("Material escalation cron failed to start:", error.message);
      }
    } else {
      console.log("Background jobs disabled.");
      console.log("Set ENABLE_BACKGROUND_JOBS=true on Hostinger only.");
    }
  });
};

startApp().catch((error) => {
  console.error("E2D startup failed:", error);
  process.exit(1);
});