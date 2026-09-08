const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// ==============================
// 設定
// ==============================

// 目前野王提醒固定發到這個頻道
const BOSS_CHANNEL_ID = "1546602217371467786";


// ==============================
// 野王重生資料（分鐘）
// ==============================

const WILD_BOSSES = {
  "紅寶王": { min: 23, max: 30 },
  "樹妖王": { min: 23, max: 30 },
  "仙人掌老": { min: 68, max: 90 },
  "殭屍猴王": { min: 38, max: 45 },
  "巨居蟹": { min: 45, max: 60 },
  "冥界幽靈": { min: 45, max: 60 },
  "咕咕鐘": { min: 68, max: 90 },
  "仙人娃娃": { min: 158, max: 180 },
  "喵怪仙人": { min: 150, max: 170 },
  "蘑菇王": { min: 210, max: 240 },
  "書生幽靈": { min: 150, max: 300 },
  "巨大深山人蔘": { min: 60, max: 135 },
  "紅藍雙怪": { min: 113, max: 135 },
  "雪山魔女": { min: 158, max: 180 },
  "沼澤巨鱷": { min: 90, max: 105 },
  "殭屍蘑菇王": { min: 195, max: 225 },
  "厄運死神": { min: 45, max: 105 },
  "葛雷金剛": { min: 270, max: 350 },
  "竹刀武士": { min: 113, max: 128 },
  "九尾妖狐": { min: 210, max: 570 },
  "肯德熊": { min: 113, max: 128 },
  "自動警備系統": { min: 158, max: 173 },
  "巴洛古": { min: 405, max: 540 },
  "迪特和洛依": { min: 150, max: 165 },
  "艾利傑": { min: 118, max: 128 },
  "奇美拉": { min: 120, max: 135 },
  "黑輪王": { min: 780, max: 1020 },
  "雪毛怪人": { min: 45, max: 68 },
  "藍色蘑菇王": { min: 720, max: 1880 },
  "瘋狂喵z客": { min: 120, max: 420 },
  "噴火龍": { min: 20, max: 60 },
  "格瑞芬多": { min: 20, max: 60 },
  "海怒斯": { min: 180, max: 300 },
  "寒霜冰龍": { min: 240, max: 720 },
  "多多": { min: 45, max: 315 },
  "利里諾斯": { min: 45, max: 315 },
  "萊伊卡": { min: 45, max: 315 }
};

// ==============================
// 暫存資料
// Bot 重啟後會清空
// ==============================

const bossRecords = new Map();
const searchRecords = [];
const selectedBoss = new Map();
const userChannels = new Map();

// ==============================
// 時間工具
// ==============================

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

// ==============================
// 取得使用者目前 CH
// ==============================

function getUserChannel(guildId, userId) {
  return userChannels.get(`${guildId}:${userId}`);
}

function setUserChannel(guildId, userId, channelNumber) {
  userChannels.set(`${guildId}:${userId}`, channelNumber);
}

// ==============================
// 建立面板
// ==============================

function createBossPanel() {
  const embed = new EmbedBuilder()
    .setColor("#E67E22")
    .setTitle("👑 EtheReal 野王追蹤")
    .setDescription(
      "先選擇野王，再使用下方按鈕回報。\n\n" +
      "☠️ **已擊殺**：記錄擊殺時間並計算重生\n" +
      "❌ **未找到**：記錄這一頻已搜尋過\n" +
      "🔢 **更換 CH**：切換你目前所在頻道\n" +
      "📋 **查看紀錄**：查看目前野王情報\n\n" +
      "第一次使用時會請你輸入 CH，之後 Bot 會記住。"
    )
    .setFooter({
      text: "EtheReal｜野王追蹤系統"
    });

  const bossNames = Object.keys(WILD_BOSSES);
  const components = [];

  for (let i = 0; i < bossNames.length; i += 25) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`boss_select_${i}`)
          .setPlaceholder(
            i === 0 ? "👑 選擇野王" : "👑 更多野王"
          )
          .addOptions(
            bossNames.slice(i, i + 25).map(name => ({
              label: name,
              value: name
            }))
          )
      )
    );
  }
  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("boss_killed")
        .setLabel("已擊殺")
        .setEmoji("☠️")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("boss_not_found")
        .setLabel("未找到")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("boss_change_channel")
        .setLabel("更換 CH")
        .setEmoji("🔢")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("boss_view")
        .setLabel("查看紀錄")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Success)
    )
  );

  return {
    embeds: [embed],
    components
  };
}


function createQuickActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("boss_killed")
      .setLabel("已擊殺")
      .setEmoji("☠️")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("boss_not_found")
      .setLabel("未找到")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("boss_change_boss")
      .setLabel("換王")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("boss_change_channel")
      .setLabel("換 CH")
      .setEmoji("🔢")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("boss_view")
      .setLabel("紀錄")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Success)
  );
}

// ==============================
// CH 輸入視窗
// ==============================

function createChannelModal(type, bossName = "") {
  const modal = new ModalBuilder()
    .setCustomId(
      bossName
        ? `${type}:${bossName}`
        : type
    )
    .setTitle("設定目前 CH");

  const input = new TextInputBuilder()
    .setCustomId("boss_channel")
    .setLabel("請輸入目前 CH")
    .setPlaceholder("例如：125")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(4);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  return modal;
}

// ==============================
// 啟動
// ==============================

function setupBossTracker(client) {

  // ============================
  // 所有成員都可以自行叫出野王面板
  // ============================

  client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content.trim() !== "-野王") {
      return;
    }

    await message.channel.send(
      createBossPanel()
    );

    // 有刪除訊息權限時，自動刪掉成員輸入的 -野王
    await message.delete().catch(() => {});
  });

  // ============================
  // Interaction
  // ============================

  client.on("interactionCreate", async interaction => {
    try {

      if (!interaction.guild) return;

      // ========================
      // 選擇野王
      // ========================

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith("boss_select_")
      ) {
        const bossName = interaction.values[0];

        selectedBoss.set(
          `${interaction.guild.id}:${interaction.user.id}`,
          bossName
        );

        const currentChannel = getUserChannel(
          interaction.guild.id,
          interaction.user.id
        );

        await interaction.reply({
          content:
            `👑 已選擇：**${bossName}**\n` +
            (currentChannel
              ? `📡 目前 CH：**${currentChannel}**\n\n`
              : "📡 目前還沒有設定 CH\n\n") +
            "可以直接按 **☠️ 已擊殺** 或 **❌ 未找到**。",
          components: [
            createQuickActionRow()
          ],
          ephemeral: true
        });

        return;
      }

      // ========================
// 換王
// ========================

if (
  interaction.isButton() &&
  interaction.customId === "boss_change_boss"
) {
  const bossNames = Object.keys(WILD_BOSSES);

  const components = [];

  for (let i = 0; i < bossNames.length; i += 25) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`boss_select_${i}`)
          .setPlaceholder(
            i === 0
              ? "👑 選擇野王"
              : "👑 更多野王"
          )
          .addOptions(
            bossNames.slice(i, i + 25).map(name => ({
              label: name,
              value: name
            }))
          )
      )
    );
  }

  await interaction.reply({
    content: "🔄 請選擇下一隻要回報的野王：",
    components,
    ephemeral: true
  });

  return;
}

      // ========================
      // 更換 CH
      // ========================

      if (
        interaction.isButton() &&
        interaction.customId === "boss_change_channel"
      ) {
        await interaction.showModal(
          createChannelModal("boss_change_channel_modal")
        );
        return;
      }

      // ========================
      // 已擊殺
      // ========================

      if (
        interaction.isButton() &&
        interaction.customId === "boss_killed"
      ) {
        const key =
          `${interaction.guild.id}:${interaction.user.id}`;

        const bossName =
          selectedBoss.get(key);

        if (!bossName) {
          await interaction.reply({
            content: "❌ 請先選擇野王。",
            ephemeral: true
          });
          return;
        }

        const currentChannel =
          getUserChannel(
            interaction.guild.id,
            interaction.user.id
          );

        if (!currentChannel) {
          await interaction.showModal(
            createChannelModal(
              "boss_killed_modal",
              bossName
            )
          );
          return;
        }

        await saveKillRecord(
          interaction,
          bossName,
          currentChannel
        );

        return;
      }

      // ========================
      // 未找到
      // ========================

      if (
        interaction.isButton() &&
        interaction.customId === "boss_not_found"
      ) {
        const key =
          `${interaction.guild.id}:${interaction.user.id}`;

        const bossName =
          selectedBoss.get(key);

        if (!bossName) {
          await interaction.reply({
            content: "❌ 請先選擇野王。",
            ephemeral: true
          });
          return;
        }

        const currentChannel =
          getUserChannel(
            interaction.guild.id,
            interaction.user.id
          );

        if (!currentChannel) {
          await interaction.showModal(
            createChannelModal(
              "boss_not_found_modal",
              bossName
            )
          );
          return;
        }

        await saveNotFoundRecord(
          interaction,
          bossName,
          currentChannel
        );

        return;
      }

      // ========================
      // 更換 CH Modal
      // ========================

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
          "boss_change_channel_modal"
      ) {
        const channelNumber =
          parseChannelNumber(interaction);

        if (!channelNumber) return;

        setUserChannel(
          interaction.guild.id,
          interaction.user.id,
          channelNumber
        );

        await interaction.reply({
          content:
            `✅ 目前頻道已更換為 **CH ${channelNumber}**`,
          components: [
            createQuickActionRow()
          ],
          ephemeral: true
        });

        return;
      }

      // ========================
      // 第一次擊殺輸入 CH
      // ========================

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "boss_killed_modal:"
        )
      ) {
        const bossName =
          interaction.customId.split(":")[1];

        const channelNumber =
          parseChannelNumber(interaction);

        if (!channelNumber) return;

        setUserChannel(
          interaction.guild.id,
          interaction.user.id,
          channelNumber
        );

        await saveKillRecord(
          interaction,
          bossName,
          channelNumber
        );

        return;
      }

      // ========================
      // 第一次未找到輸入 CH
      // ========================

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "boss_not_found_modal:"
        )
      ) {
        const bossName =
          interaction.customId.split(":")[1];

        const channelNumber =
          parseChannelNumber(interaction);

        if (!channelNumber) return;

        setUserChannel(
          interaction.guild.id,
          interaction.user.id,
          channelNumber
        );

        await saveNotFoundRecord(
          interaction,
          bossName,
          channelNumber
        );

        return;
      }

      // ========================
      // 查看紀錄
      // ========================

      if (
        interaction.isButton() &&
        interaction.customId === "boss_view"
      ) {
        const guildId =
          interaction.guild.id;

        const kills =
          [...bossRecords.values()]
            .filter(
              record =>
                record.guildId === guildId
            )
            .sort(
              (a, b) =>
                a.earliest - b.earliest
            );

        const searches =
          searchRecords
            .filter(
              record =>
                record.guildId === guildId
            )
            .slice(-10)
            .reverse();

        let description = "";

        if (kills.length > 0) {
          description +=
            "### ☠️ 擊殺 / 重生紀錄\n";

          description +=
            kills
              .slice(0, 15)
              .map(record =>
                `**${record.bossName}**｜CH ${record.channelNumber}\n` +
                `🌱 ${formatTime(record.earliest)} ～ ${formatTime(record.latest)}`
              )
              .join("\n\n");
        }

        if (searches.length > 0) {
          if (description) {
            description += "\n\n";
          }

          description +=
            "### ❌ 最近未找到\n";

          description +=
            searches
              .map(record =>
                `**${record.bossName}**｜CH ${record.channelNumber}｜${formatTime(record.time)}`
              )
              .join("\n");
        }

        if (!description) {
          description =
            "目前還沒有任何野王紀錄。";
        }

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#3498DB")
              .setTitle("📋 野王追蹤紀錄")
              .setDescription(
                description.slice(0, 4000)
              )
          ],
          ephemeral: true
        });

        return;
      }

    } catch (error) {
      console.error(
        "❌ 野王系統錯誤：",
        error
      );

      if (
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "❌ 野王系統發生錯誤，請稍後再試。",
          ephemeral: true
        }).catch(() => {});
      }
    }
  });

  // ============================
  // 每分鐘檢查提醒
  // ============================

  setInterval(async () => {
    const now = Date.now();

    for (const [key, record] of bossRecords) {

      const guild =
        client.guilds.cache.get(
          record.guildId
        );

      if (!guild) continue;

      const channel =
        guild.channels.cache.get(
          BOSS_CHANNEL_ID
        );

      if (!channel?.isTextBased()) {
        continue;
      }

      // 最早重生前 10 分鐘
      if (
        !record.preReminderSent &&
        now >=
          record.earliest -
          10 * 60 * 1000 &&
        now < record.earliest
      ) {
        record.preReminderSent = true;

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#F1C40F")
              .setTitle(
                `🔔 ${record.bossName} 即將重生`
              )
              .setDescription(
                `📡 **CH ${record.channelNumber}**\n\n` +
                `🌱 最早重生：**${formatTime(record.earliest)}**\n` +
                `⏰ 最晚重生：**${formatTime(record.latest)}**\n\n` +
                "距離最早重生約 10 分鐘。"
              )
          ]
        });
      }

      // 進入重生區間
      if (
        !record.spawnReminderSent &&
        now >= record.earliest
      ) {
        record.spawnReminderSent = true;

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#E74C3C")
              .setTitle(
                `🚨 ${record.bossName} 已進入重生區間`
              )
              .setDescription(
                `📡 **CH ${record.channelNumber}**\n\n` +
                `🌱 最早：**${formatTime(record.earliest)}**\n` +
                `⏰ 最晚：**${formatTime(record.latest)}**\n\n` +
                "可以開始找王了！"
              )
          ]
        });
      }

      // 最晚重生後 2 小時清除
      if (
        now >
        record.latest +
        2 * 60 * 60 * 1000
      ) {
        bossRecords.delete(key);
      }
    }

  }, 60 * 1000);
}

// ==============================
// 驗證 CH
// ==============================

function parseChannelNumber(interaction) {
  const text =
    interaction.fields
      .getTextInputValue("boss_channel")
      .trim();

  if (!/^\d{1,4}$/.test(text)) {
    interaction.reply({
      content:
        "❌ CH 請只輸入數字，例如：125",
      ephemeral: true
    }).catch(() => {});

    return null;
  }

  const channelNumber = Number(text);

  if (
    channelNumber < 1 ||
    channelNumber > 2500
  ) {
    interaction.reply({
      content:
        "❌ CH 請輸入 1～2500。",
      ephemeral: true
    }).catch(() => {});

    return null;
  }

  return channelNumber;
}

// ==============================
// 儲存擊殺
// ==============================

async function saveKillRecord(
  interaction,
  bossName,
  channelNumber
) {
  const config =
    WILD_BOSSES[bossName];

  if (!config) {
    await interaction.reply({
      content:
        "❌ 找不到這隻野王資料。",
      ephemeral: true
    });
    return;
  }

  const killedAt = Date.now();

  const earliest =
    killedAt +
    config.min * 60 * 1000;

  const latest =
    killedAt +
    config.max * 60 * 1000;

  const recordKey =
    `${interaction.guild.id}:${bossName}:${channelNumber}`;

  bossRecords.set(recordKey, {
    guildId: interaction.guild.id,
    bossName,
    channelNumber,
    killedAt,
    earliest,
    latest,
    userId: interaction.user.id,
    preReminderSent: false,
    spawnReminderSent: false
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#57F287")
        .setTitle(
          `☠️ ${bossName} 已擊殺`
        )
        .addFields(
          {
            name: "📡 CH",
            value: `${channelNumber}`,
            inline: true
          },
          {
            name: "☠️ 擊殺",
            value: formatTime(killedAt),
            inline: true
          },
          {
            name: "🌱 最早重生",
            value: formatTime(earliest),
            inline: false
          },
          {
            name: "⏰ 最晚重生",
            value: formatTime(latest),
            inline: false
          },
          {
            name: "👤 回報",
            value: `${interaction.user}`,
            inline: true
          }
        )
        .setFooter({
          text: `目前 CH ${channelNumber}｜可直接繼續回報`
        })
    ],
    components: [
      createQuickActionRow()
    ]
  });
}

// ==============================
// 儲存未找到
// ==============================

async function saveNotFoundRecord(
  interaction,
  bossName,
  channelNumber
) {
  const time = Date.now();

  searchRecords.push({
    guildId: interaction.guild.id,
    bossName,
    channelNumber,
    time,
    userId: interaction.user.id
  });

  // 只保留最近 200 筆
  if (searchRecords.length > 200) {
    searchRecords.shift();
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#95A5A6")
        .setTitle(
          `❌ ${bossName} 未找到`
        )
        .setDescription(
          `📡 **CH ${channelNumber}**\n` +
          `🕒 ${formatTime(time)}\n` +
          `👤 ${interaction.user}`
        )
        .setFooter({
          text: `目前 CH ${channelNumber}｜可直接繼續回報`
        })
    ],
    components: [
      createQuickActionRow()
    ]
  });
}

module.exports = {
  setupBossTracker
};
