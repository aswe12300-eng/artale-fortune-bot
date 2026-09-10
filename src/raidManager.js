const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require("discord.js");

const { google } = require("googleapis");

// ==============================
// 基本設定
// ==============================

const RAID_SHEET_NAME = "突襲報名";

const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY =
  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

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


// ==============================
// 台灣時間
// ==============================

function getTaipeiDate() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Taipei"
    })
  );
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}/${m}/${d}`;
}


// ==============================
// 本週週次：星期二～下週一
// ==============================

function getCurrentRaidWeekRange() {
  const now = getTaipeiDate();
  const day = now.getDay();

  let diffToTuesday;

  if (day === 0) {
    diffToTuesday = -5;
  } else if (day === 1) {
    diffToTuesday = -6;
  } else {
    diffToTuesday = 2 - day;
  }

  const tuesday = new Date(now);
  tuesday.setHours(0, 0, 0, 0);
  tuesday.setDate(
    now.getDate() + diffToTuesday
  );

  const monday = new Date(tuesday);
  monday.setDate(
    tuesday.getDate() + 6
  );

  return `${formatDate(tuesday)}～${formatDate(monday)}`;
}


// ==============================
// 讀取試算表
// ==============================

async function getRaidRows() {
  const res =
    await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:
        `${RAID_SHEET_NAME}!A2:L`
    });

  return res.data.values || [];
}


// ==============================
// 取得目前週次有效報名
// ==============================

async function getCurrentWeekSignups() {
  const week =
    getCurrentRaidWeekRange();

  const rows =
    await getRaidRows();

  return rows.filter(
    row =>
      row[0] === week &&
      row[11] !== "已取消"
  );
}


// ==============================
// 取得某隻王的報名者
// ==============================

async function getBossSignups(
  bossName
) {
  const rows =
    await getCurrentWeekSignups();

  return rows.filter(row => {
    const bosses =
      String(row[7] || "")
        .split("、")
        .map(v => v.trim());

    return bosses.includes(
      bossName
    );
  });
}


// ==============================
// 解析可打時段
// ==============================

function parseTimes(text) {
  const result = [];

  if (!text) {
    return result;
  }

  const lines =
    String(text)
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);

  for (const line of lines) {
    const parts =
      line.split("：");

    if (parts.length < 2) {
      continue;
    }

    const day =
      parts[0].trim();

    const times =
      parts[1]
        .split("、")
        .map(v => v.trim())
        .filter(Boolean);

    for (const time of times) {
      result.push({
        day,
        time,
        key:
          `${day}|${time}`
      });
    }
  }

  return result;
}


// ==============================
// 時段排序
// ==============================

const DAY_ORDER = [
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
  "星期日",
  "星期一"
];

const TIME_ORDER = [
  "09:00",
  "12:00",
  "18:00",
  "20:00",
  "22:00"
];

function sortTimeKeys(keys) {
  return keys.sort(
    (a, b) => {
      const [
        dayA,
        timeA
      ] = a.split("|");

      const [
        dayB,
        timeB
      ] = b.split("|");

      const dayDiff =
        DAY_ORDER.indexOf(dayA) -
        DAY_ORDER.indexOf(dayB);

      if (dayDiff !== 0) {
        return dayDiff;
      }

      return (
        TIME_ORDER.indexOf(timeA) -
        TIME_ORDER.indexOf(timeB)
      );
    }
  );
}


// ==============================
// 統計各時段人數
// ==============================

function buildTimeStats(rows) {
  const stats = {};

  for (const row of rows) {
    const times =
      parseTimes(
        row[8]
      );

    for (const item of times) {
      if (!stats[item.key]) {
        stats[item.key] = [];
      }

      stats[item.key].push(row);
    }
  }

  return stats;
}


// ==============================
// 王選單
// ==============================

function buildBossSelect() {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_manager_boss"
      )
      .setPlaceholder(
        "選擇要查看的突襲王"
      )
      .addOptions(
        {
          label: "普拉",
          value: "普拉",
          emoji: "👹"
        },
        {
          label: "炎魔",
          value: "炎魔",
          emoji: "🔥"
        },
        {
          label: "困拉",
          value: "困拉",
          emoji: "⚔️"
        },
        {
          label: "龍王",
          value: "龍王",
          emoji: "🐲"
        }
      );

  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 時段選單
// ==============================

function buildTimeSelect(
  bossName,
  stats
) {
  const keys =
    sortTimeKeys(
      Object.keys(stats)
    );

  const options =
    keys
      .slice(0, 25)
      .map(key => {
        const [
          day,
          time
        ] = key.split("|");

        const count =
          stats[key]?.length || 0;

        return {
          label:
            `${day} ${time}｜${count} 人`,
          value:
            `${bossName}|${key}`,
          description:
            `查看這個時段可參加的 ${count} 位角色`
        };
      });

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_manager_time"
      )
      .setPlaceholder(
        "選擇時段查看名單"
      )
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 管理主面板
// ==============================

function buildManagerEmbed() {
  return new EmbedBuilder()
    .setColor("#F1C40F")
    .setTitle(
      "⚔️ EtheReal｜突襲排團管理"
    )
    .setDescription(
      `📅 **目前週次：${getCurrentRaidWeekRange()}**\n\n` +
      "請先選擇要查看的突襲王。\n\n" +
      "系統會自動統計各時段可參加人數，" +
      "再選時段即可查看角色名單。"
    )
    .setFooter({
      text:
        "僅供管理員排團使用"
    });
}


// ==============================
// 某隻王統計畫面
// ==============================

function buildBossStatsEmbed(
  bossName,
  rows,
  stats
) {
  const keys =
    Object.keys(stats);

  const ranked =
    [...keys]
      .sort(
        (a, b) =>
          stats[b].length -
          stats[a].length
      )
      .slice(0, 5);

  let rankingText =
    "目前沒有可用時段資料。";

  if (ranked.length > 0) {
    rankingText =
      ranked
        .map(
          (key, index) => {
            const [
              day,
              time
            ] = key.split("|");

            const medal =
              index === 0
                ? "🥇"
                : index === 1
                ? "🥈"
                : index === 2
                ? "🥉"
                : "▫️";

            return (
              `${medal} ${day} ${time}｜` +
              `**${stats[key].length} 人**`
            );
          }
        )
        .join("\n");
  }

  return new EmbedBuilder()
    .setColor("#3498DB")
    .setTitle(
      `👹 ${bossName}｜報名統計`
    )
    .setDescription(
      `📅 **${getCurrentRaidWeekRange()}**\n\n` +
      `👥 報名角色：**${rows.length} 人**\n\n` +
      `🔥 **人數最多時段**\n${rankingText}\n\n` +
      "請使用下方選單查看指定時段名單。"
    );
}


// ==============================
// 某時段詳細名單
// ==============================

function buildTimeDetailEmbed(
  bossName,
  day,
  time,
  rows
) {
  const embed =
    new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle(
        `⚔️ ${bossName}｜${day} ${time}`
      )
      .setDescription(
        `📅 **${getCurrentRaidWeekRange()}**\n` +
        `👥 共 **${rows.length}** 隻角色可以參加`
      );

  rows
    .slice(0, 25)
    .forEach(
      (row, index) => {

        const allTimes =
          parseTimes(
            row[8]
          );

        const otherTimes =
          allTimes
            .filter(
              item =>
                !(
                  item.day === day &&
                  item.time === time
                )
            )
            .map(
              item =>
                `${item.day.replace("星期", "週")}${item.time}`
            );

        const otherText =
          otherTimes.length > 0
            ? otherTimes.join("、")
            : "無其他時段";

        embed.addFields({
          name:
            `${index + 1}. ${row[3] || "未命名角色"}`,
          value:
            `🧙 ${row[4] || "-"}｜Lv.${row[5] || "-"}｜表功 ${row[6] || "-"}\n` +
            `🕒 其他可配合：${otherText}\n` +
            `📝 備註：${row[9] || "無"}`,
          inline:
            false
        });
      }
    );

  if (
    rows.length > 25
  ) {
    embed.setFooter({
      text:
        `目前顯示前 25 隻，共 ${rows.length} 隻角色`
    });
  }

  return embed;
}


// ==============================
// 啟動管理系統
// ==============================

function setupRaidManager(client) {

  // ============================
  // 管理員文字指令
  // ============================

  client.on(
    "messageCreate",
    async message => {

      if (message.author.bot) {
        return;
      }

      if (!message.guild) {
        return;
      }

      if (
        message.content.trim() !==
        "-突襲名單"
      ) {
        return;
      }

      if (
        !message.member.permissions.has(
          "ManageGuild"
        )
      ) {
        return message.reply(
          "❌ 只有管理員可以使用突襲排團功能。"
        );
      }

      return message.reply({
        embeds: [
          buildManagerEmbed()
        ],
        components: [
          buildBossSelect()
        ]
      });
    }
  );


  // ============================
  // 下拉選單
  // ============================

  client.on(
    "interactionCreate",
    async interaction => {

      try {

        if (
          !interaction.isStringSelectMenu()
        ) {
          return;
        }


        // =====================
        // 選擇王
        // =====================

        if (
          interaction.customId ===
          "raid_manager_boss"
        ) {

          if (
            !interaction.member.permissions.has(
              "ManageGuild"
            )
          ) {
            return interaction.reply({
              content:
                "❌ 只有管理員可以使用這個功能。",
              ephemeral:
                true
            });
          }

          const bossName =
            interaction.values[0];

          const rows =
            await getBossSignups(
              bossName
            );

          if (
            rows.length === 0
          ) {
            return interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor("#95A5A6")
                  .setTitle(
                    `👹 ${bossName}｜報名統計`
                  )
                  .setDescription(
                    "目前這隻王還沒有人報名。"
                  )
              ],
              components: [
                buildBossSelect()
              ]
            });
          }

          const stats =
            buildTimeStats(
              rows
            );

          if (
            Object.keys(stats).length === 0
          ) {
            return interaction.update({
              embeds: [
                buildBossStatsEmbed(
                  bossName,
                  rows,
                  stats
                )
              ],
              components: [
                buildBossSelect()
              ]
            });
          }

          return interaction.update({
            embeds: [
              buildBossStatsEmbed(
                bossName,
                rows,
                stats
              )
            ],
            components: [
              buildBossSelect(),
              buildTimeSelect(
                bossName,
                stats
              )
            ]
          });
        }


        // =====================
        // 選擇時段
        // =====================

        if (
          interaction.customId ===
          "raid_manager_time"
        ) {

          if (
            !interaction.member.permissions.has(
              "ManageGuild"
            )
          ) {
            return interaction.reply({
              content:
                "❌ 只有管理員可以使用這個功能。",
              ephemeral:
                true
            });
          }

          const value =
            interaction.values[0];

          const parts =
            value.split("|");

          const bossName =
            parts[0];

          const day =
            parts[1];

          const time =
            parts[2];

          const rows =
            await getBossSignups(
              bossName
            );

          const available =
            rows.filter(row => {

              const times =
                parseTimes(
                  row[8]
                );

              return times.some(
                item =>
                  item.day === day &&
                  item.time === time
              );
            });


          const stats =
            buildTimeStats(
              rows
            );


          return interaction.update({

            embeds: [

              buildTimeDetailEmbed(

                bossName,

                day,

                time,

                available

              )

            ],

            components: [

              buildBossSelect(),

              buildTimeSelect(
                bossName,
                stats
              )

            ]

          });

        }


      } catch (error) {

        console.error(
          "突襲排團管理系統錯誤：",
          error
        );


        if (
          interaction.deferred ||
          interaction.replied
        ) {

          await interaction.followUp({

            content:
              "❌ 讀取突襲名單時發生錯誤。",

            ephemeral:
              true

          }).catch(() => {});

        } else {

          await interaction.reply({

            content:
              "❌ 讀取突襲名單時發生錯誤。",

            ephemeral:
              true

          }).catch(() => {});

        }

      }

    }
  );
}


// ==============================
// 匯出
// ==============================

module.exports = {
  setupRaidManager
};
