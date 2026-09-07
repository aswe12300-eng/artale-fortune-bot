const { client } = require("./src/coreBot");
const {
  setupRegistration
} = require("./src/registration");

const {
  setupSupportRole
} = require("./src/supportRole");

const {
  setupBossTracker
} = require("./src/bossTracker");

setupRegistration(client);
setupSupportRole(client);
setupBossTracker(client);

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("Discord 登入失敗：", error);
  process.exitCode = 1;
});
