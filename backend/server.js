require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { initWhatsapp } = require("./src/services/whatsappService");
const { startMaterialEscalationCron } = require("./src/jobs/materialEscalationCron");
const { startWhatsappBufferCron } = require("./src/jobs/whatsappBufferCron");

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, async () => {
  console.log(`E2D backend running on port ${PORT}`);

  await initWhatsapp();
  startWhatsappBufferCron();
  startMaterialEscalationCron();
});