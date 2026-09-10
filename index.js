const coreBot = require("./src/coreBot");

const client = coreBot.client || coreBot;

const {
  setupRegistration
} = require("./src/registration");

const {
  setupSupportRole
} = require("./src/supportRole");

const {
  setupBossTracker
} = require("./src/bossTracker");

const {
  setupRaidSignup
} = require("./src/raidSignup");

if (!client || typeof client.on !== "function") {
  console.error("❌ Discord client 載入失敗");
  console.error(
    "coreBot exports:",
    Object.keys(coreBot || {})
  );
  process.exit(1);
}

setupRegistration(client);
setupSupportRole(client);
setupBossTracker(client);
setupRaidSignup(client);

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("Discord 登入失敗：", error);
  process.exitCode = 1;
});
