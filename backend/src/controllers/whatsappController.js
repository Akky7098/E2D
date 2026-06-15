const QRCode = require("qrcode");

const {
  getWhatsappClient,
  forceCheckWhatsappStatus,
  restartWhatsappClient,
} = require("../services/whatsappService");

const getWhatsappStatus = async (req, res) => {
  try {
    getWhatsappClient();

    const status = await forceCheckWhatsappStatus();

    let qrImage = null;

    if (status.qr) {
      qrImage = await QRCode.toDataURL(status.qr);
    }

    return res.json({
      success: true,
      ready: status.ready,
      state: status.state,
      error: status.error || "",
      hasQr: Boolean(status.qr),
      qrImage,
      sessionPath: status.sessionPath,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const showWhatsappQrPage = async (req, res) => {
  try {
    getWhatsappClient();

    const status = await forceCheckWhatsappStatus();
    const qr = status.qr;

    if (status.ready) {
      return res.send(`
        <html>
          <head>
            <title>E2D WhatsApp Connected</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: Arial; background:#f1f5f9; margin:0; padding:20px; }
              .card { max-width:430px; margin:50px auto; background:white; padding:24px; border-radius:16px; text-align:center; box-shadow:0 18px 50px rgba(0,0,0,.14); }
              h2 { color:#16a34a; }
              p { color:#475569; line-height:1.5; }
              a { display:inline-block; margin-top:14px; color:#2563eb; font-weight:bold; }
              .path { margin-top:12px; font-size:12px; color:#64748b; word-break:break-all; background:#f8fafc; padding:10px; border-radius:10px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>WhatsApp Connected ✅</h2>
              <p>E2D company WhatsApp is connected.</p>
              <div class="path">${status.sessionPath || ""}</div>
              <a href="/api/whatsapp/status-page">Refresh</a>
            </div>
          </body>
        </html>
      `);
    }

    if (!qr) {
      return res.send(`
        <html>
          <head>
            <title>E2D WhatsApp QR</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta http-equiv="refresh" content="8" />
            <style>
              body { font-family: Arial; background:#f1f5f9; margin:0; padding:20px; }
              .card { max-width:430px; margin:50px auto; background:white; padding:24px; border-radius:16px; text-align:center; box-shadow:0 18px 50px rgba(0,0,0,.14); }
              h2 { color:#0f172a; }
              p { color:#475569; line-height:1.5; }
              a { display:inline-block; margin-top:14px; padding:12px 16px; border-radius:10px; background:#2563eb; color:white; text-decoration:none; font-weight:bold; }
              .state { margin-top:12px; font-size:13px; color:#334155; background:#f8fafc; padding:10px; border-radius:10px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Generating WhatsApp QR...</h2>
              <p>Please wait. QR generation can take 10–30 seconds.</p>
              <div class="state">State: ${status.state || "INITIALIZING"}</div>
              ${status.error ? `<div class="state">Error: ${status.error}</div>` : ""}
              <a href="/api/whatsapp/restart-page">Restart WhatsApp Client</a>
            </div>
          </body>
        </html>
      `);
    }

    const qrImage = await QRCode.toDataURL(qr);

    return res.send(`
      <html>
        <head>
          <title>Scan E2D WhatsApp QR</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta http-equiv="refresh" content="25" />
          <style>
            body { font-family: Arial; background:#f1f5f9; margin:0; padding:20px; }
            .card { max-width:430px; margin:35px auto; background:white; padding:24px; border-radius:16px; text-align:center; box-shadow:0 18px 50px rgba(0,0,0,.14); }
            h2 { color:#0f172a; margin-bottom:8px; }
            p { color:#475569; line-height:1.5; }
            img { width:280px; max-width:100%; border:1px solid #e5e7eb; border-radius:12px; padding:10px; background:#fff; }
            .note { background:#eff6ff; color:#1e3a8a; padding:10px; border-radius:10px; font-size:13px; margin-top:16px; }
            a { display:inline-block; margin-top:14px; color:#2563eb; font-weight:bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Scan E2D WhatsApp QR</h2>
            <p>Open WhatsApp → Linked Devices → Link Device</p>
            <img src="${qrImage}" alt="WhatsApp QR" />
            <div class="note">
              After scanning, wait 10–20 seconds. Page will auto-refresh.
            </div>
            <a href="/api/whatsapp/status-page">Refresh Status</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const restartWhatsapp = async (req, res) => {
  try {
    await restartWhatsappClient();

    return res.json({
      success: true,
      message: "WhatsApp restart started",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const restartWhatsappPage = async (req, res) => {
  try {
    await restartWhatsappClient();

    return res.send(`
      <html>
        <head>
          <title>E2D WhatsApp Restart</title>
          <meta http-equiv="refresh" content="8;url=/api/whatsapp/status-page" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family:Arial; background:#f1f5f9; padding:30px; }
            .card { max-width:430px; margin:50px auto; background:white; padding:24px; border-radius:16px; text-align:center; box-shadow:0 18px 50px rgba(0,0,0,.14); }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>WhatsApp client restarted</h2>
            <p>Redirecting to QR/status page...</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  getWhatsappStatus,
  showWhatsappQrPage,
  restartWhatsapp,
  restartWhatsappPage,
};