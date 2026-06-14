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
const { google } = require("googleapis");

const DATA_FILE = "./levels.json";

const IGNORED_XP_CHANNELS = [
  "1487074463563649164", // 規章公告
  "1487146529667026986", // 官方消息
  "1487033416330383432", // 新人報到
  "1512732594595434547", // 點歌台
  "1497601369518116874", // 管理群
  "1515361647722496182"  // 🏆 公會活躍紀錄
];

let levelData = {};

const xpCooldown = new Map();
const voiceSessions = new Map();

if (fs.existsSync(DATA_FILE)) {
  levelData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveLevelData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(levelData, null, 2));
}

function getLevel(xp) {
  return Math.floor(Math.sqrt(xp / 5));
}

function getRequiredXp(level) {
  return (level + 1) * (level + 1) * 5;
}

// ===== 稱號系統 =====

function getTitle(level) {
  if (level >= 50) return "🌈 EtheReal 傳說";
  if (level >= 30) return "👑 EtheReal 菁英";
  if (level >= 20) return "🔥 核心成員";
  if (level >= 10) return "⚔️ 活躍會員";
  if (level >= 5) return "🌱 公會新兵";

  return "🍁 初心冒險者";
}

function createExpBar(currentXp, requiredXp) {
  const totalBars = 10;

  const safeCurrentXp = Math.max(0, currentXp);
  const safeRequiredXp = Math.max(1, requiredXp);

  const percent = Math.min(safeCurrentXp / safeRequiredXp, 1);

  const filledBars = Math.floor(percent * totalBars);
  const emptyBars = totalBars - filledBars;

  return "🟩".repeat(filledBars) + "⬜".repeat(emptyBars);
}
async function loadLevelsFromSheet() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "工作表1!A2:L"
  });

  const rows = res.data.values || [];

  rows.forEach(row => {
    const [
  guildId,
  userId,
  name,
  xp,
  level,
  messages,
  achievements,
  voiceMinutes,
  voiceStart,
  lastUpdate,
  voiceXpToday,
  voiceXpDate
] = row;

    if (guildId && userId) {
      if (!levelData[guildId]) {
        levelData[guildId] = {};
      }

      levelData[guildId][userId] = {
  name: name || "未知成員",
  xp: Number(xp) || 0,
  messages: Number(messages) || 0,
  achievements: achievements
  ? achievements.split(",")
  : [],
  voiceMinutes: Number(voiceMinutes) || 0,
  voiceStart: voiceStart || null,
  voiceXpToday: Number(voiceXpToday) || 0,
  voiceXpDate: voiceXpDate || null
};;
    }
  });

  console.log("✅ 已從 Google Sheets 載入多伺服器 XP");
}

async function saveLevelsToSheet() {
  const values = [];

  Object.entries(levelData).forEach(([guildId, users]) => {
    Object.entries(users).forEach(([userId, data]) => {
     values.push([
  guildId,
  userId,
  data.name || "未知成員",
  data.xp || 0,
  getLevel(data.xp || 0),
  data.messages || 0,
 (data.achievements || []).join(","),
data.voiceMinutes || 0,
data.voiceStart || "",
new Date().toLocaleString("zh-TW", {
  timeZone: "Asia/Taipei"
}),
data.voiceXpToday || 0,
data.voiceXpDate || ""
]);
    });
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: "工作表1!A2:L"
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "工作表1!A2:L",
    valueInputOption: "RAW",
    requestBody: {
      values
    }
  });
}
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Running");
}).listen(process.env.PORT || 3000);

const TOKEN = process.env.DISCORD_TOKEN;
const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const auth = new google.auth.JWT(
  GOOGLE_CLIENT_EMAIL,
  null,
  GOOGLE_PRIVATE_KEY,
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({
  version: "v4",
  auth
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
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
  levelData[member.guild.id]?.[member.id]?.name ||
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

// ===== 成就系統 =====

async function checkAchievements(message, userData, extra = {}) {

  const achievementChannel =
    message.guild.channels.cache.get(ACHIEVEMENT_CHANNEL_ID);

  if (!achievementChannel) return;

  const achievements = userData.achievements || [];

   const achievementList = [
  {
    id: "talk50",
    name: "💬 話癆 I",
    requirement: 50,
    reward: 10,
    type: "messages"
  },
  {
    id: "talk200",
    name: "💬 話癆 II",
    requirement: 200,
    reward: 30,
    type: "messages"
  },
  {
    id: "talk500",
    name: "💬 話癆 III",
    requirement: 500,
    reward: 100,
    type: "messages"
  },

  // 🍁 隱藏成就
  {
  id: "elder",
  name: "🍁 公會元老",
  requirement: 20,
  reward: 50,
  type: "level",
  hidden: true
},
{
  id: "voiceCamp",
  name: "🏕️ 語音露營",
  requirement: 480,
  reward: 80,
  type: "singleVoice",
  hidden: true
},
{
  id: "ghost",
  name: "👻 幽靈成員",
  reward: 50,
  hidden: true,
  type: "ghost"
}
  ];

  for (const achievement of achievementList) {

    let completed = false;

if (achievement.type === "messages") {
  completed =
    userData.messages >= achievement.requirement;
}

if (achievement.type === "level") {
  completed =
    getLevel(userData.xp) >= achievement.requirement;
}
    if (achievement.type === "singleVoice") {
  completed =
    (extra.singleVoiceMinutes || 0) >= achievement.requirement;
}
    if (achievement.type === "ghost") {
  completed =
    (userData.voiceMinutes || 0) >= 1200 &&
    (userData.messages || 0) <= 20;
}


  completed = topUserId === message.author.id;
}  

if (
  completed &&
  !achievements.includes(achievement.id)
) {

  achievements.push(achievement.id);

  // 🎁 發放成就獎勵 XP
  userData.xp += achievement.reward;

  const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🏆 成就解鎖")
        .setDescription(
  `🎉 **${userData.name}** 解鎖成就！\n\n` +
  `${achievement.name}\n` +
  `累積發言 ${achievement.requirement} 次\n\n` +
  `🎁 獲得獎勵：+${achievement.reward} XP`
)
        .setTimestamp();

      await achievementChannel.send({
        embeds: [embed]
      });
    }
  }

  userData.achievements = achievements;
}

client.once("ready", async () => {
  await loadLevelsFromSheet();
  console.log(`✅ ${client.user.tag} 已上線`);
});

// =====================
// 新成員加入時紀錄暱稱
// =====================

client.on("guildMemberAdd", member => {
  const guildId = member.guild.id;
  const displayName =
    member.displayName ||
    member.user.username;

  if (!levelData[guildId]) {
    levelData[guildId] = {};
  }

  if (!levelData[guildId][member.id]) {
    levelData[guildId][member.id] = {
  xp: 0,
  name: displayName,
  messages: 0,
  achievements: [],
  voiceMinutes: 0,
voiceStart: null,
      voiceXpToday: 0,
  voiceXpDate: null
};
  } else {
    levelData[guildId][member.id].name = displayName;
  }

  saveLevelData();
});
// =====================
// 成員改暱稱時更新
// =====================

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const displayName =
    newMember.displayName ||
    newMember.user.username;

  const guildId = newMember.guild.id;

  if (!levelData[guildId]) {
    levelData[guildId] = {};
  }

  if (!levelData[guildId][newMember.id]) {
    levelData[guildId][newMember.id] = {
  xp: 0,
  name: displayName,
  messages: 0,
  achievements: [],
  voiceMinutes: 0,
voiceStart: null,
      voiceXpToday: 0,
  voiceXpDate: null
};
  } else {
    levelData[guildId][newMember.id].name = displayName;
  }

  saveLevelData();

  try {
    await saveLevelsToSheet();
  } catch (err) {
    console.error("暱稱更新儲存失敗：", err);
  }
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

  const guildId = message.guild.id;
const userId = message.author.id;
const displayName = message.member?.displayName || message.author.username;

if (!levelData[guildId]) {
  levelData[guildId] = {};
}

if (!levelData[guildId][userId]) {
  levelData[guildId][userId] = {
  xp: 0,
  name: displayName,
  messages: 0,
  achievements: [],
  voiceMinutes: 0,
voiceStart: null,
    voiceXpToday: 0,
  voiceXpDate: null
};
}

const userData = levelData[guildId][userId];

  if (!IGNORED_XP_CHANNELS.includes(message.channel.id)) {

  const now = Date.now();
  const lastXpTime = xpCooldown.get(userId) || 0;
  const cooldown = 30 * 1000;

  if (now - lastXpTime >= cooldown) {

    const oldLevel = getLevel(userData.xp);

  userData.xp += 1;
userData.name = displayName;

userData.messages = (userData.messages || 0) + 1;
await checkAchievements(message, userData);
const newLevel = getLevel(userData.xp);

xpCooldown.set(userId, now);

saveLevelData();

try {
  await saveLevelsToSheet();
} catch (err) {
  console.error("Google Sheets 儲存失敗：", err);
}
    if (newLevel > oldLevel) {

      const levelUpEmbed = new EmbedBuilder()
        .setColor("#F1C40F")
        .setTitle("🎉 Level Up！")
        .setDescription(
          `恭喜 **${displayName}** 等級提升！\n\n` +
          `🏅 Lv.${oldLevel} ➜ **Lv.${newLevel}**\n\n` +
          `🍁 繼續保持活躍，一起讓 EtheReal 更熱鬧！`
        )
        .setThumbnail(
          message.author.displayAvatarURL({
            extension: "png",
            size: 256
          })
        )
        .setFooter({
          text: "EtheReal 活躍等級系統"
        })
        .setTimestamp();

      const levelChannel =
  message.guild.channels.cache.get(LEVEL_CHANNEL_ID);

if (levelChannel) {
  await levelChannel.send({
    embeds: [levelUpEmbed]
  });
    }
  }
}
}
  if (message.content.trim() === "-等級") {
  const xp = userData.xp;
  const level = getLevel(xp);
    const title = getTitle(level);

  const currentLevelXp = level * level * 5;
  const nextLevelXp = getRequiredXp(level);
  const progressXp = xp - currentLevelXp;
  const requiredXp = nextLevelXp - currentLevelXp;
  const percent = Math.min(
  Math.floor((progressXp / requiredXp) * 100),
  100
);
  const expBar = createExpBar(progressXp, requiredXp);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#9B59FF")
        .setTitle(`📊 ${displayName} 的冒險紀錄`)
        .addFields(
  {
    name: "🏅 等級",
    value: `Lv.${level}`,
    inline: true
  },
          {
  name: "🎖 稱號",
  value: title,
  inline: true
},
  {
    name: "🔥 活躍值",
    value: `${xp}`,
    inline: true
  },
  {
    name: "💬 發言次數",
    value: `${userData.messages || 0}`,
    inline: true
  },
  {
    name: "🏆 成就",
    value: `${userData.achievements?.length || 0} 個`,
    inline: true
  },
          {
  name: "🎧 語音時數",
  value: `${((userData.voiceMinutes || 0) / 60).toFixed(1)} 小時`,
  inline: true
},
  {
    name: "⭐ 經驗條",
    value: `${expBar} ${percent}%\n${progressXp}/${requiredXp}`,
    inline: false
  }
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
 if (message.content.trim() === "-成就") {
  const achievements = userData.achievements || [];

  const achievementList = [
  { id: "talk50", name: "💬 話癆 I" },
  { id: "talk200", name: "💬 話癆 II" },
  { id: "talk500", name: "💬 話癆 III" },

  { id: "elder", name: "🍁 公會元老", hidden: true },
  { id: "voiceCamp", name: "🏕️ 語音露營", hidden: true },
    { id: "ghost", name: "👻 幽靈成員", hidden: true }
];

  const text = achievementList
  .map(a => {

    if (achievements.includes(a.id)) {
      return `✅ ${a.name}`;
    }

    if (a.hidden) {
      return `❓ 未知成就`;
    }

    return `⬜ ${a.name}`;
  })
    .join("\n");

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle(`🏆 ${displayName} 的成就`)
        .setDescription(text)
        .addFields({
          name: "📊 進度",
          value: `${achievements.length} / ${achievementList.length} 已解鎖`
        })
        .setTimestamp()
    ]
  });
}

if (message.content.trim() === "-語音排行") {
  const guildRanking = levelData[guildId] || {};

  const ranking = Object.entries(guildRanking)
    .sort((a, b) => (b[1].voiceMinutes || 0) - (a[1].voiceMinutes || 0))
    .slice(0, 10);

  const text = ranking
    .map(([id, data], index) => {
      const hours = ((data.voiceMinutes || 0) / 60).toFixed(1);
      return `**${index + 1}. ${data.name}**｜🎧 ${hours} 小時`;
    })
    .join("\n");

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#3498DB")
        .setTitle("🎧 本伺服器語音排行榜")
        .setDescription(text || "目前還沒有語音資料")
        .setFooter({ text: "依照本伺服器語音累積時數統計" })
        .setTimestamp()
    ]
  });
}

if (message.content.trim() === "-排行榜") {
  const guildRanking = levelData[guildId] || {};

  const ranking = Object.entries(guildRanking)
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
        .setTitle("🏆 本伺服器 DC 活躍排行榜")
        .setDescription(text || "目前還沒有排行榜資料")
        .setFooter({ text: "依照本伺服器 Discord 發言活躍度統計" })
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

// ===== 頻道設定 =====
const LEAVE_CHANNEL_ID = "1497601369518116874";       // 管理群
const LEVEL_CHANNEL_ID = "1515361647722496182";       // 公會紀錄
const ACHIEVEMENT_CHANNEL_ID = "1515361647722496182"; // 公會紀錄
client.on("voiceStateUpdate", async (oldState, newState) => {
  const member = newState.member || oldState.member;

  if (!member || member.user.bot) return;

  const guildId = member.guild.id;
  const userId = member.id;
  const key = `${guildId}-${userId}`;

  if (!levelData[guildId]) {
    levelData[guildId] = {};
  }

  if (!levelData[guildId][userId]) {
    levelData[guildId][userId] = {
      xp: 0,
      name: member.displayName,
      messages: 0,
      achievements: [],
      voiceMinutes: 0,
      voiceStart: null,
      voiceXpToday: 0,
  voiceXpDate: null
    };
  }

  const userData = levelData[guildId][userId];

  // 進入語音
  if (!oldState.channel && newState.channel) {
    const now = Date.now();

    userData.voiceStart = String(now);
    voiceSessions.set(key, now);

    saveLevelData();

    try {
      await saveLevelsToSheet();
    } catch (err) {
      console.error("語音開始儲存失敗：", err);
    }

    return;
  }

  // 離開語音
  if (oldState.channel && !newState.channel) {
    const startTime =
      Number(userData.voiceStart) ||
      voiceSessions.get(key);

    if (!startTime) return;

    const minutes = Math.floor((Date.now() - startTime) / 60000);

    voiceSessions.delete(key);
   userData.voiceStart = null;
userData.voiceMinutes = (userData.voiceMinutes || 0) + minutes;
    // 🎧 語音 XP：30 分鐘 = 1 XP，每日最多 15 XP
const today = new Date().toLocaleDateString("zh-TW", {
  timeZone: "Asia/Taipei"
});

if (userData.voiceXpDate !== today) {
  userData.voiceXpDate = today;
  userData.voiceXpToday = 0;
}

const rawVoiceXp = Math.floor(minutes / 30);
const remainingVoiceXp = Math.max(0, 15 - (userData.voiceXpToday || 0));
const voiceXp = Math.min(rawVoiceXp, remainingVoiceXp);

userData.xp += voiceXp;
userData.voiceXpToday = (userData.voiceXpToday || 0) + voiceXp;


await checkAchievements(
  {
    guild: member.guild
  },
  userData,
  {
    singleVoiceMinutes: minutes
  }
);

 console.log(
  `🎧 ${member.displayName} 語音 ${minutes} 分鐘 (+${voiceXp} XP，今日語音XP ${userData.voiceXpToday}/15)`
);

    saveLevelData();

    try {
      await saveLevelsToSheet();
    } catch (err) {
      console.error("語音結算儲存失敗：", err);
    }
  }
});
client.on("guildMemberRemove", async member => {
  try {
    const channel = member.guild.channels.cache.get(LEAVE_CHANNEL_ID);
    if (!channel) return;

    const displayName =
  levelData[member.guild.id]?.[member.id]?.name ||
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
