const { Client, GatewayIntentBits } = require("discord.js");
const http = require("http");

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Running");
}).listen(process.env.PORT || 3000);

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
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

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} 已上線`);
  console.log("✅ -占卜 指令已啟用");
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content.trim() !== "-占卜") return;

  const drop = random(1, 100);
  const enhance = random(1, 100);
  const boss = random(1, 100);
  const gacha = random(1, 100);
  const channel = random(1, 2500);

  const fortune = pick(fortunes);
  const advice = pick(adviceList);
  const poem = pick(poemList);
  const oracle = pick(oracleList);

  await message.reply(
`🍁 **皮卡皮卡皮卡占卜** 🍁

👤 抽籤者：${message.member?.displayName || message.author.username}

🍀 今日運勢：${fortune}

💰 掉寶運：${drop}%
⚒️ 衝裝運：${enhance}%
📡 幸運頻道：CH ${channel}
👹 打王運：${boss}%
🎲 轉蛋運：${gacha}%

📜 今日建議：
${advice}

🥠 公會籤詩：
${poem}

💸 公會神諭：
${oracle}

━━━━━━━━━━━━━━

⚠️ 本占卜內容僅供娛樂參考

掉寶率、衝裝率、幸運頻道、
打王運與轉蛋運皆為隨機產生，
實際結果請以遊戲內狀況為準。

祝各位天天出貨、一發入魂 🍁`
  );
});

client.login(TOKEN);
