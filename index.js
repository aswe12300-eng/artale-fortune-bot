const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const http = require("http");

const fs = require("fs");

const DATA_FILE = "./levels.json";

const IGNORED_XP_CHANNELS = [
  "1487074463563649164", // 規章公告
  "1487146529667026986", // 官方消息
  "1487033416330383432", // 新人報到
  "1512732594595434547", // 點歌台
  "1497601369518116874"  // 管理群
];

let levelData = {};

if (fs.existsSync(DATA_FILE)) {
  levelData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveLevelData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(levelData, null, 2));
}

function getLevel(xp) {
  return Math.floor(Math.sqrt(xp / 10));
}

function getRequiredXp(level) {
  return (level + 1) * (level + 1) * 10;
}

function createExpBar(currentXp, requiredXp) {
  const totalBars = 10;
  const percent = currentXp / requiredXp;
  const filledBars = Math.floor(percent * totalBars);
  const emptyBars = totalBars - filledBars;

  return "🟩".repeat(filledBars) + "⬜".repeat(emptyBars);
}

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Running");
}).listen(process.env.PORT || 3000);

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
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
  const luckyScore = random(1, 100);

  const fortune = pick(fortunes);
  const advice = pick(adviceList);
  const poem = pick(poemList);
  const oracle = pick(oracleList);

  const fortuneColors = {
    "🌈 天選之人": "#FFD700",
    "✨ 超級大吉": "#F1C40F",
    "🍀 大吉": "#2ECC71",
    "😊 吉": "#3498DB",
    "🙂 小吉": "#9B59B6",
    "😐 普通": "#95A5A6",
    "😵 凶": "#E67E22",
    "💀 大凶": "#E74C3C"
  };

  const displayName =
  levelData[member.id]?.name ||
  member.displayName ||
  member.user.username;

  const avatar = user.displayAvatarURL({
    extension: "png",
    size: 512
  });

  return new EmbedBuilder()
    .setColor(fortuneColors[fortune] || "#9B59FF")
    .setAuthor({
      name: `${displayName} 的占卜結果`,
      iconURL: avatar
    })
    .setTitle("🍀今日運勢")
    .setDescription(
      `**${fortune}**\n⭐ 幸運指數：**${luckyScore}/100**`
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
        name: "📡 幸運頻道",
        value: `CH ${channel}`,
        inline: true
      },
      {
        name: "⭐ 歐氣值",
        value: `${luckyScore}/100`,
        inline: true
      },
      {
        name: "🥠 今日籤詩",
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
      text: "占卜內容僅供娛樂參考｜祝各位天天出貨 🍁"
    })
    .setTimestamp();
}

function createButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("draw_fortune")
      .setLabel("🍀 再抽一次")
      .setStyle(ButtonStyle.Success)
  );
}

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} 已上線`);
});

// =====================
// 新成員加入時紀錄暱稱
// =====================

client.on("guildMemberAdd", member => {
  const displayName =
    member.displayName ||
    member.user.username;

  if (!levelData[member.id]) {
    levelData[member.id] = {
      xp: 0,
      name: displayName
    };
  } else {
    levelData[member.id].name = displayName;
  }

  saveLevelData();
});
// =====================
// 成員改暱稱時更新
// =====================

client.on("guildMemberUpdate", (oldMember, newMember) => {
  const displayName =
    newMember.displayName ||
    newMember.user.username;

  if (!levelData[newMember.id]) {
    levelData[newMember.id] = {
      xp: 0,
      name: displayName
    };
  } else {
    levelData[newMember.id].name = displayName;
  }

  saveLevelData();
});

client.on("messageCreate", async message => {

  console.log(
    `[XP] ${message.guild?.name} | #${message.channel.name} | ${message.author.username}`
  );

  console.log(
    `[XP CHECK] ${message.channel.name} (${message.channel.id})`
  );

  if (message.author.bot) return;
  if (!message.guild) return;

  const userId = message.author.id;
  const displayName = message.member?.displayName || message.author.username;

  if (!levelData[userId]) {
    levelData[userId] = {
      xp: 0,
      name: displayName
    };
  }

  if (!IGNORED_XP_CHANNELS.includes(message.channel.id)) {
  const oldLevel = getLevel(levelData[userId].xp);

 levelData[userId].xp += 1;
  levelData[userId].name = displayName;

  const newLevel = getLevel(levelData[userId].xp);

  saveLevelData();

  if (newLevel > oldLevel) {
    const levelUpEmbed = new EmbedBuilder()
      .setColor("#F1C40F")
      .setTitle("🎉 Level Up！")
      .setDescription(
        `恭喜 **${displayName}** 等級提升！\n\n` +
        `🏅 Lv.${oldLevel} ➜ **Lv.${newLevel}**\n\n` +
        `🍁 繼續保持活躍，一起讓 EtheReal 更熱鬧！`
      )
      .setThumbnail(message.author.displayAvatarURL({ extension: "png", size: 256 }))
      .setFooter({ text: "EtheReal 活躍等級系統" })
      .setTimestamp();

    await message.channel.send({
      embeds: [levelUpEmbed]
    });
  }
}

  if (message.content.trim() === "-等級") {
  const xp = levelData[userId].xp;
  const level = getLevel(xp);

  const currentLevelXp = level * level * 10;
  const nextLevelXp = getRequiredXp(level);
  const progressXp = xp - currentLevelXp;
  const requiredXp = nextLevelXp - currentLevelXp;
  const percent = Math.floor((progressXp / requiredXp) * 100);
  const expBar = createExpBar(progressXp, requiredXp);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#9B59FF")
        .setTitle(`📊 ${displayName} 的冒險紀錄`)
        .setDescription(
          `🏅 **等級**\nLv.${level}\n\n` +
          `⭐ **經驗值**\n${progressXp} / ${requiredXp}\n\n` +
          `${expBar} **${percent}%**\n\n` +
          `🔥 **總活躍值**\n${xp}`
        )
        .setThumbnail(message.author.displayAvatarURL({ extension: "png", size: 256 }))
        .setFooter({ text: "EtheReal 活躍等級系統" })
        .setTimestamp()
    ]
  });
}
  if (message.content.trim() === "-檢查頻道") {

  const channels = message.guild.channels.cache
    .filter(c => c.isTextBased());

  let result = "";

  channels.forEach(channel => {

    const xpEnabled = !IGNORED_XP_CHANNELS.includes(channel.id);

    result += xpEnabled
      ? `🟢 ${channel.name}\n`
      : `🔴 ${channel.name}\n`;
  });

  return message.reply(result);
}
  if (message.content.trim() === "-排行榜") {
    const ranking = Object.entries(levelData)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 10);

    const text = ranking
      .map(([id, data], index) => {
        return `**${index + 1}. ${data.name}**｜Lv.${getLevel(data.xp)}｜${data.xp} 活躍值`;
      })
      .join("\n");

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#FFD700")
          .setTitle("🏆 EtheReal DC 活躍排行榜")
          .setDescription(text || "目前還沒有排行榜資料")
          .setFooter({ text: "依照 Discord 發言活躍度統計" })
          .setTimestamp()
      ]
    });
  }

  if (message.content.trim() === "-占卜") {
    const embed = createFortuneEmbed(
      message.author,
      message.member
    );

    await message.reply({
      embeds: [embed],
      components: [createButtonRow()]
    });
  }
});


client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "draw_fortune") {
    const embed = createFortuneEmbed(
      interaction.user,
      interaction.member
    );

    await interaction.reply({
      embeds: [embed],
      components: [createButtonRow()]
    });
  }
});
// =====================
// 成員離開通知
// =====================

const LEAVE_CHANNEL_ID = "1497601369518116874";

client.on("guildMemberRemove", async member => {
  try {
    const channel = member.guild.channels.cache.get(LEAVE_CHANNEL_ID);
    if (!channel) return;

    const displayName =
  levelData[member.id]?.name ||
  member.displayName ||
  member.user.username;

    const embed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setTitle("📤 成員離開通知")
      .setDescription(`🍁 **${displayName}** 已離開 EtheReal`)
      .setTimestamp();

    await channel.send({
      embeds: [embed]
    });
  } catch (err) {
    console.error("成員離開通知錯誤：", err);
  }
});
client.login(TOKEN);
