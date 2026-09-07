const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require("discord.js");

// ==============================
// 設定
// ==============================

// 之後改成你的「野王紀錄 / 野王提醒」頻道 ID
const BOSS_CHANNEL_ID = "請填野王頻道ID";

// 幹部身分組
const STAFF_ROLE_ID = "1487011622798102660";

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
// 重啟 Bot 後會清空
// ==============================

const bossRecords = new Map();
const selectedBoss = new Map();

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
// 建立野王面板
// ==============================

function createBossPanel() {
  const embed = new EmbedBuilder()
    .setColor("#E67E22")
    .setTitle("👑 EtheReal 野王重生紀錄")
    .setDescription(
      "請先從下方選擇野王。\n\n" +
      "選好後點擊 **☠️ 已擊殺**，輸入 CH 即可完成紀錄。\n\n" +
      "Bot 會自動計算：\n" +
      "🌱 最早重生時間\n" +
      "⏰ 最晚重生時間\n" +
      "🔔 最早重生前 10 分鐘提醒\n" +
      "🚨 進入重生區間提醒"
    )
    .setFooter({
      text: "EtheReal｜野王追蹤系統"
    });

  const bossNames = Object.keys(WILD_BOSSES);

  const rows = [];

  for (let i = 0; i < bossNames.length; i += 25) {
    const options = bossNames
      .slice(i, i + 25)
      .map(name => ({
        label: name,
        value: name
      }));

    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`boss_select_${i / 25}`)
          .setPlaceholder(
            i === 0
              ? "請選擇野王"
              : "更多野王"
          )
          .addOptions(options)
      )
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("boss_killed")
        .setLabel("已擊殺")
        .setEmoji("☠️")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("boss_view")
        .setLabel("查看紀錄")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Primary)
    )
  );

  return {
    embeds: [embed],
    components: rows
  };
}

// ==============================
// 啟動系統
// ==============================

function setupBossTracker(client) {

  // ============================
  // 建立面板指令
  // ============================

  client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (
      message.content.trim() !==
      "-建立野王面板"
    ) {
      return;
    }

    const isAdministrator =
      message.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      );

    const isStaff =
      message.member.roles.cache.has(
        STAFF_ROLE_ID
      );

    if (!isAdministrator && !isStaff) {
      await message.reply(
        "❌ 只有管理員或幹部可以建立野王面板。"
      );
      return;
    }

    if (message.channel.id !== BOSS_CHANNEL_ID) {
      await message.reply(
        `❌ 請到 <#${BOSS_CHANNEL_ID}> 使用這個指令。`
      );
      return;
    }

    await message.channel.send(
      createBossPanel()
    );

    await message.delete().catch(() => {});
  });

  // ============================
  // 按鈕 / 下拉
  // ============================

  client.on("interactionCreate", async interaction => {
    try {

      // 選野王
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith(
          "boss_select_"
        )
      ) {
        const bossName =
          interaction.values[0];

        selectedBoss.set(
          interaction.user.id,
          bossName
        );

        await interaction.reply({
          content:
            `✅ 已選擇：**${bossName}**\n` +
            "請點擊 **☠️ 已擊殺**。",
          ephemeral: true
        });

        return;
      }

      // 已擊殺
      if (
        interaction.isButton() &&
        interaction.customId ===
          "boss_killed"
      ) {
        const bossName =
          selectedBoss.get(
            interaction.user.id
          );

        if (!bossName) {
          await interaction.reply({
            content:
              "❌ 請先從上方選擇一隻野王。",
            ephemeral: true
          });

          return;
        }

        const modal =
          new ModalBuilder()
            .setCustomId(
              `boss_kill_modal:${bossName}`
            )
            .setTitle(
              `${bossName}｜擊殺紀錄`
            );

        const channelInput =
          new TextInputBuilder()
            .setCustomId("boss_channel")
            .setLabel("請輸入 CH")
            .setPlaceholder(
              "例如：125"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(4);

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              channelInput
            )
        );

        await interaction.showModal(modal);
        return;
      }

      // Modal 提交
      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "boss_kill_modal:"
        )
      ) {
        const bossName =
          interaction.customId.split(
            ":"
          )[1];

        const channelText =
          interaction.fields
            .getTextInputValue(
              "boss_channel"
            )
            .trim();

        if (!/^\d{1,4}$/.test(channelText)) {
          await interaction.reply({
            content:
              "❌ CH 請只輸入數字，例如：125",
            ephemeral: true
          });

          return;
        }

        const channelNumber =
          Number(channelText);

        if (
          channelNumber < 1 ||
          channelNumber > 2500
        ) {
          await interaction.reply({
            content:
              "❌ CH 請輸入 1～2500。",
            ephemeral: true
          });

          return;
        }

        const config =
          WILD_BOSSES[bossName];

        if (!config) {
          await interaction.reply({
            content:
              "❌ 找不到這隻野王的資料。",
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

        const key =
          `${interaction.guild.id}:${bossName}:${channelNumber}`;

        bossRecords.set(key, {
          guildId:
            interaction.guild.id,
          bossName,
          channelNumber,
          killedAt,
          earliest,
          latest,
          userId:
            interaction.user.id
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#57F287")
              .setTitle(
                `☠️ ${bossName} 擊殺紀錄`
              )
              .addFields(
                {
                  name: "📡 頻道",
                  value:
                    `CH ${channelNumber}`,
                  inline: true
                },
                {
                  name: "☠️ 擊殺時間",
                  value:
                    formatTime(killedAt),
                  inline: true
                },
                {
                  name: "🌱 最早重生",
                  value:
                    formatTime(earliest),
                  inline: true
                },
                {
                  name: "⏰ 最晚重生",
                  value:
                    formatTime(latest),
                  inline: true
                },
                {
                  name: "👤 回報者",
                  value:
                    `${interaction.user}`,
                  inline: true
                }
              )
              .setFooter({
                text:
                  "已啟用自動重生提醒"
              })
          ]
        });

        return;
      }

      // 查看紀錄
      if (
        interaction.isButton() &&
        interaction.customId ===
          "boss_view"
      ) {
        const records = [
          ...bossRecords.values()
        ].filter(
          record =>
            record.guildId ===
            interaction.guild.id
        );

        if (records.length === 0) {
          await interaction.reply({
            content:
              "📋 目前還沒有野王擊殺紀錄。",
            ephemeral: true
          });

          return;
        }

        const sorted =
          records
            .sort(
              (a, b) =>
                a.earliest - b.earliest
            )
            .slice(0, 20);

        const text =
          sorted
            .map(record => {
              return (
                `**${record.bossName}**｜` +
                `CH ${record.channelNumber}\n` +
                `🌱 ${formatTime(record.earliest)}` +
                ` ～ ` +
                `${formatTime(record.latest)}`
              );
            })
            .join("\n\n");

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#3498DB")
              .setTitle(
                "📋 野王重生紀錄"
              )
              .setDescription(text)
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
    }
  });

  // ============================
  // 每分鐘檢查提醒
  // ============================

  setInterval(async () => {
    const now = Date.now();

    for (
      const [key, record]
      of bossRecords
    ) {

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
        now <
          record.earliest
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
                `📡 CH ${record.channelNumber}\n\n` +
                `🌱 最早重生：**${formatTime(record.earliest)}**\n` +
                `⏰ 最晚重生：**${formatTime(record.latest)}**\n\n` +
                "距離最早重生約 10 分鐘，可以準備找王了！"
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
                `📡 CH ${record.channelNumber}\n\n` +
                `🌱 最早：**${formatTime(record.earliest)}**\n` +
                `⏰ 最晚：**${formatTime(record.latest)}**\n\n` +
                "現在可以開始找王了！"
              )
          ]
        });
      }

      // 超過最晚重生 2 小時後清除
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

module.exports = {
  setupBossTracker
};
