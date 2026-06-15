const cron = require("node-cron");

const {
  forceCheckWhatsappStatus,
  restartWhatsappClient,
} = require("../services/whatsappService");

let started = false;

const startWhatsappHealthCron = () => {
  if (started) {
    console.log("WhatsApp health cron already started");
    return;
  }

  started = true;

  cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        const status = await forceCheckWhatsappStatus();

        console.log(
          `WhatsApp health check: ready=${status.ready}, state=${status.state}`
        );

        if (
          !status.ready &&
          ["DISCONNECTED", "NOT_CONNECTED", "UNPAIRED", "TIMEOUT", "INIT_FAILED"].includes(
            status.state
          )
        ) {
          console.log("WhatsApp not ready. Restarting client...");
          await restartWhatsappClient();
        }
      } catch (error) {
        console.error("WhatsApp health cron failed:", error.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("WhatsApp health cron scheduled");
};

module.exports = startWhatsappHealthCron;