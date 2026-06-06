const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");

const http = require("http");

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Artale Fortune Bot Running");
}).listen(process.env.PORT || 3000);

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const fortunes = [
  "🌈 天選之人",
  "✨ 超級大吉",
  "🍀 大吉",
  "😊 吉",
  "🙂 小吉",
  "😐 普通",
  "😵 凶",
  "💀 大凶"
];

const adviceList = [
  "今天適合打王、刷寶，掉寶運不錯可以多試幾場。",
  "今天衝裝可以小試手氣，但不建議梭哈。",
  "今天適合農材料、存楓幣，穩穩賺比較安心。",
  "今天適合逛拍賣，可能會看到意外便宜貨。",
  "今天建議先解每日，等手感順了再打王。",
  "今天適合開箱或轉蛋，但記得見好就收。",
  "今天不太適合硬衝裝，先把錢留著比較安全。",
  "今天適合找公會成員一起打王，歐氣比較容易聚集。"
];

const poemList = [
  "時來運轉，順勢而行。",
  "小心為上，莫貪一時。",
  "今日有光，宜進不宜退。",
  "運藏冷門，福在遠方。",
  "守得雲開見月明。",
  "穩中求勝，方能長久。",
  "歐氣將至，請保持冷靜。",
  "今日若順，可乘勢而上。"
];

const oracleList = [
  "出貨請截圖，否則視為幻想。",
  "衝過神裝者，歡迎自願分紅散播歐氣。",
  "打到好寶請至公會頻道繳交炫耀稅。",
  "今日歐氣來自公會祝福，發財別忘了大家。",
  "神裝出世，公會全體有圍觀權。",
  "今日若出貨，請記得請公會喝個水。",
  "本公會不強制分紅，但歡迎自願樂捐。",
  "歐洲人請自重，非洲人請明日再戰。"
];

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("占卜")
      .setDescription("抽取今日 Artale 公會占卜")
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ /占卜 指令已註冊");
}

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} 已上線`);
  await registerCommands();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "占卜") {
    const drop = random(1, 100);
    const enhance = random(1, 100);
    const boss = random(1, 100);
    const gacha = random(1, 100);
    const channel = random(1, 2500);

    const fortune = pick(fortunes);
    const advice = pick(adviceList);
    const poem = pick(poemList);
    const oracle = pick(oracleList);

    await interaction.reply(
`🍁 **Artale 今日占卜** 🍁

👤 抽籤者：${interaction.user.displayName}

🍀 今日運勢：${fortune}

💰 掉寶運：${drop}%
⚒️ 衝裝運：${enhance}%
👹 打王運：${boss}%
🎲 轉蛋運：${gacha}%
📡 幸運頻道：CH ${channel}

📜 今日建議：
${advice}

🥠 公會籤詩：
${poem}

💸 公會神諭：
${oracle}`
    );
  }
});

client.login(TOKEN);
