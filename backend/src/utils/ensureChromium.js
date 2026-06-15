const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

let chromiumReady = false;

const chmodRecursive = (targetPath) => {
  if (!fs.existsSync(targetPath)) return;

  const stat = fs.statSync(targetPath);
  fs.chmodSync(targetPath, 0o755);

  if (stat.isDirectory()) {
    fs.readdirSync(targetPath).forEach((child) => {
      chmodRecursive(path.join(targetPath, child));
    });
  }
};

const ensureChromium = async () => {
  if (chromiumReady) return;

  try {
    const executablePath = puppeteer.executablePath();

    console.log("CHROMIUM PATH =>", executablePath);

    if (executablePath && fs.existsSync(executablePath)) {
      const chromiumRoot = path.dirname(path.dirname(executablePath));
      chmodRecursive(chromiumRoot);
      fs.chmodSync(executablePath, 0o755);
    }

    chromiumReady = true;
  } catch (error) {
    console.log("CHROMIUM CHECK ERROR =>", error.message);
    chromiumReady = true;
  }
};

module.exports = ensureChromium;