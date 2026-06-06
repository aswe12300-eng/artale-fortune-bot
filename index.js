const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

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

function createFortuneEmbed(user, member) {
  const drop = random(1, 100);
  const enhance = random(1, 100);
  const boss = random(1, 100);
  const gacha = random(1, 100);
  const channel = random(1, 2500);

  const fortune = pick(fortunes);
  const advice = pick(adviceList);
  const poem = pick(poemList);
  const oracle = pick(oracleList);

  const displayName = member?.displayName || user.username;
  const avatar = user.displayAvatarURL({
    extension: "png",
    size: 512
  });

  const embed = new EmbedBuilder()
    .setColor("#9B59FF")
    .setAuthor({
      name: `${displayName} 的占卜結果`,
      iconURL: avatar
    })
    .setTitle("🍁 皮卡皮卡皮卡占卜 🍁")
    .setDescription(
      `👤 **抽籤者：${displayName}**\n\n` +
      `🍀 **今日運勢：${fortune}**`
    )
    .setThumbnail(avatar)
    .addFields(
      {
        name: "💰 掉寶運",
        value: `${drop}%`,
        inline: true
      },
      {
        name: "⚒️ 衝裝運",
        value: `${enhance}%`,
        inline: true
      },
      {
        name: "📡 幸運頻道",
        value: `CH ${channel}`,
        inline: true
      },
      {
        name: "👹 打王運",
        value: `${boss}%`,
        inline: true
      },
      {
        name: "🎲 轉蛋運",
        value: `${gacha}%`,
        inline: true
      },
      {
        name: "🥠 公會籤詩",
        value: poem,
        inline: false
      },
      {
        name: "📜 今日建議",
        value: advice,
        inline: false
      },
      {
        name: "💸 公會神諭",
        value: oracle,
        inline: false
      }
    )
    .setFooter({
      text: "占卜內容僅供娛樂參考｜祝各位天天出貨、一發入魂 🍁"
    })
    .setTimestamp();

  return embed;
}

function createButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("draw_fortune")
      .setLabel("🍀 抽今日運勢")
      .setStyle(ButtonStyle.Primary)
  );
}

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} 已上線`);
  console.log("✅ -占卜 指令已啟用");
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content.trim() !== "-占卜") return;

  const embed = createFortuneEmbed(message.author, message.member);
  const row = createButtonRow();

  await message.reply({
    embeds: [embed],
    components: [row]
  });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "draw_fortune") return;

  const embed = createFortuneEmbed(interaction.user, interaction.member);
  const row = createButtonRow();

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
});

client.login(TOKEN);
