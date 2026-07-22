const { client } = require("./src/coreBot");
const { setupRegistration } = require("./src/registration");

setupRegistration(client);

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("Discord 登入失敗：", error);
  process.exitCode = 1;
});
