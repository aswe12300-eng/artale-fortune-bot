const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const { google } = require("googleapis");

const {
  createTeamSession,
  buildTeamEmbed,
  buildTeamButtons
} = require("./raidTeamBuilder");

const raidManagerSelections =
  new Map();

// ==============================
// 全部名單分頁暫存
// ==============================

const raidAllListSessions =
  new Map();

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
  const m =
    String(date.getMonth() + 1)
      .padStart(2, "0");

  const d =
    String(date.getDate())
      .padStart(2, "0");

  return `${y}/${m}/${d}`;
}

function parseYmd(text) {
  const [y, m, d] =
    text.split("/").map(Number);

  return new Date(
    y,
    m - 1,
    d,
    0,
    0,
    0,
    0
  );
}


// ==============================
// 本週：星期二～下星期一
// ==============================

function getCurrentRaidWeekRange() {
  const now =
    getTaipeiDate();

  const day =
    now.getDay();

  let diffToTuesday;

  if (day === 0) {
    diffToTuesday = -5;
  } else if (day === 1) {
    diffToTuesday = -6;
  } else {
    diffToTuesday =
      2 - day;
  }

  const tuesday =
    new Date(now);

  tuesday.setHours(
    0,
    0,
    0,
    0
  );

  tuesday.setDate(
    now.getDate() +
    diffToTuesday
  );

  const monday =
    new Date(tuesday);

  monday.setDate(
    tuesday.getDate() + 6
  );

  return (
    `${formatDate(tuesday)}～${formatDate(monday)}`
  );
}


// ==============================
// 下週
// ==============================

function getNextRaidWeekRange() {
  const current =
    getCurrentRaidWeekRange();

  const [startText] =
    current.split("～");

  const tuesday =
    parseYmd(startText);

  tuesday.setDate(
    tuesday.getDate() + 7
  );

  const monday =
    new Date(tuesday);

  monday.setDate(
    tuesday.getDate() + 6
  );

  return (
    `${formatDate(tuesday)}～${formatDate(monday)}`
  );
}


// ==============================
// 試算表
// ==============================

async function getRaidRows() {
  const res =
    await sheets.spreadsheets.values.get({
      spreadsheetId:
        SHEET_ID,

      range:
        `${RAID_SHEET_NAME}!A2:L`
    });

  return (
    res.data.values || []
  );
}


// ==============================
// 指定週次有效報名
// ==============================

async function getWeekSignups(
  weekRange
) {
  const rows =
    await getRaidRows();

  return rows.filter(
    row =>
      row[0] === weekRange &&
      row[11] !== "已取消"
  );
}


// ==============================
// 指定週次＋指定王
// ==============================

async function getBossSignups(
  weekRange,
  bossName
) {
  const rows =
    await getWeekSignups(
      weekRange
    );

  return rows.filter(
    row => {
      const bosses =
        String(
          row[7] || ""
        )
          .split("、")
          .map(
            v => v.trim()
          );

      return bosses.includes(
        bossName
      );
    }
  );
}


// ==============================
// 解析時段
// ==============================

function parseTimes(text) {
  const result = [];

  if (!text) {
    return result;
  }

  const lines =
    String(text)
      .split("\n")
      .map(
        v => v.trim()
      )
      .filter(Boolean);

  for (const line of lines) {
    const parts =
      line.split("：");

    if (
      parts.length < 2
    ) {
      continue;
    }

    const day =
      parts[0].trim();

    const times =
      parts[1]
        .split("、")
        .map(
          v => v.trim()
        )
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

      if (
        dayDiff !== 0
      ) {
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
// 統計時段
// ==============================

function buildTimeStats(rows) {
  const stats = {};

  for (const row of rows) {
    const times =
      parseTimes(
        row[8]
      );

    for (
      const item of times
    ) {
      if (
        !stats[item.key]
      ) {
        stats[item.key] = [];
      }

      stats[item.key]
        .push(row);
    }
  }

  return stats;
}


// ==============================
// 週次選單
// ==============================

function buildWeekSelect() {
  const currentWeek =
    getCurrentRaidWeekRange();

  const nextWeek =
    getNextRaidWeekRange();

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_manager_week"
      )
      .setPlaceholder(
        "📅 選擇要查看的週次"
      )
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        {
          label:
            `本週｜${currentWeek}`,
          value:
            currentWeek,
          emoji:
            "📅"
        },
        {
          label:
            `下週｜${nextWeek}`,
          value:
            nextWeek,
          emoji:
            "⏭️"
        }
      );

  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 王選單
// 將週次放進 value
// ==============================

function buildBossSelect(
  weekRange
) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_manager_boss"
      )
      .setPlaceholder(
        "👹 選擇要查看的突襲王"
      )
      .setMinValues(1)
      .setMaxValues(1)
     .addOptions(
  {
    label: "普拉",
    value: `${weekRange}|普拉`,
    emoji: "⏰"
  },
  {
    label: "炎魔",
    value: `${weekRange}|炎魔`,
    emoji: "🔥"
  },
  {
    label: "困拉",
    value: `${weekRange}|困拉`,
    emoji: "⏱️"
  },
  {
    label: "龍王",
    value: `${weekRange}|龍王`,
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
  weekRange,
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
      .map(
        key => {
          const [
            day,
            time
          ] = key.split("|");

          const count =
            stats[key]
              ?.length || 0;

          return {
            label:
              `${day} ${time}｜${count} 人`,

            value:
              `${weekRange}|${bossName}|${day}|${time}`,

            description:
              `查看這個時段的 ${count} 位報名角色`
          };
        }
      );

  

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_manager_time"
      )
      .setPlaceholder(
        "🕒 選擇時段查看名單"
      )
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

  return new ActionRowBuilder()
    .addComponents(menu);
}

// ==============================
// 週次＋突襲王 選單
// ==============================

async function buildWeekBossOptions() {
  const rows =
    await getRaidRows();

  const currentWeek =
    getCurrentRaidWeekRange();

  const nextWeek =
    getNextRaidWeekRange();

  const map =
    new Map();

  for (const row of rows) {

    const weekRange =
      row[0];

    const status =
      row[11];

    if (
      status === "已取消"
    ) {
      continue;
    }

    if (
      weekRange !== currentWeek &&
      weekRange !== nextWeek
    ) {
      continue;
    }

    const bosses =
      String(row[7] || "")
        .split("、")
        .map(v => v.trim())
        .filter(Boolean);

    for (
      const bossName of bosses
    ) {
      const key =
        `${weekRange}|${bossName}`;

      if (
        !map.has(key)
      ) {
        map.set(
          key,
          new Set()
        );
      }

      map.get(key)
        .add(
          `${row[1]}|${row[3]}`
        );
    }
  }

  return [
    ...map.entries()
  ].map(
    ([key, players]) => {

      const splitIndex =
        key.lastIndexOf("|");

      return {
        weekRange:
          key.slice(
            0,
            splitIndex
          ),

        bossName:
          key.slice(
            splitIndex + 1
          ),

        count:
          players.size
      };
    }
  );
}


function buildWeekBossSelect(
  options
) {
  const currentWeek =
    getCurrentRaidWeekRange();

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_manager_week_boss"
      )
      .setPlaceholder(
        "📅 選擇週次＋突襲王"
      )
      .setMinValues(1)
      .setMaxValues(1);

  const discordOptions =
    options
      .slice(0, 25)
      .map(item => {

        const weekText =
          item.weekRange ===
          currentWeek
            ? "本週"
            : "下週";

        let emoji = "👹";

if (
  item.bossName === "普拉"
) {
  emoji = "⏰";
}

if (
  item.bossName === "炎魔"
) {
  emoji = "🔥";
}

if (
  item.bossName === "困拉"
) {
  emoji = "⏱️";
}

if (
  item.bossName === "龍王"
) {
  emoji = "🐲";
}

        return {
          label:
            `${weekText}｜${item.bossName}`,

          description:
            `目前 ${item.count} 隻角色報名`,

          value:
            `${item.weekRange}|${item.bossName}`,

          emoji
        };
      });

  menu.addOptions(
    discordOptions
  );

  return new ActionRowBuilder()
    .addComponents(menu);
}

// ==============================
// 開始排團按鈕
// ==============================

function buildStartTeamButton(
  weekRange,
  bossName,
  day,
  time
) {
  const button =
    new ButtonBuilder()
      .setCustomId(
        "raid_manager_start_team"
      )
      .setLabel(
        "👥 開始排團"
      )
      .setStyle(
        ButtonStyle.Success
      );

  return new ActionRowBuilder()
    .addComponents(button);
}

// ==============================
// 查看全部名單按鈕
// ==============================

function buildAllListButton() {
  const button =
    new ButtonBuilder()
      .setCustomId(
        "raid_manager_all_list"
      )
      .setLabel(
        "📋 查看全部名單"
      )
      .setStyle(
        ButtonStyle.Secondary
      );

  return new ActionRowBuilder()
    .addComponents(button);
}

function getBossEmoji(
  bossName
) {
  if (
    bossName === "普拉"
  ) {
    return "⏰";
  }

  if (
    bossName === "炎魔"
  ) {
    return "🔥";
  }

  if (
    bossName === "困拉"
  ) {
    return "⏱️";
  }

  if (
    bossName === "龍王"
  ) {
    return "🐲";
  }

  return "👹";
}

// ==============================
// 建立全部突襲名單分頁
// ==============================

async function buildAllRaidListPages() {
  const rows =
    await getRaidRows();

  const currentWeek =
    getCurrentRaidWeekRange();

  const nextWeek =
    getNextRaidWeekRange();

  const activeRows =
    rows.filter(
      row =>
        (
          row[0] === currentWeek ||
          row[0] === nextWeek
        ) &&
        row[11] !== "已取消"
    );

  const groups =
    new Map();

  for (
    const row of activeRows
  ) {
    const weekRange =
      row[0];

    const bosses =
      String(
        row[7] || ""
      )
        .split("、")
        .map(
          v => v.trim()
        )
        .filter(Boolean);

    for (
      const bossName of bosses
    ) {
      const key =
        `${weekRange}|${bossName}`;

      if (
        !groups.has(key)
      ) {
        groups.set(
          key,
          []
        );
      }

      groups
        .get(key)
        .push(row);
    }
  }


  const bossOrder = [
    "普拉",
    "炎魔",
    "困拉",
    "龍王"
  ];

  const sortedGroups =
    [...groups.entries()]
      .sort(
        (a, b) => {

          const [
            weekA,
            bossA
          ] =
            a[0].split("|");

          const [
            weekB,
            bossB
          ] =
            b[0].split("|");

          if (
            weekA !== weekB
          ) {
            if (
              weekA === currentWeek
            ) {
              return -1;
            }

            if (
              weekB === currentWeek
            ) {
              return 1;
            }
          }

          return (
            bossOrder.indexOf(
              bossA
            ) -
            bossOrder.indexOf(
              bossB
            )
          );
        }
      );


  const pages = [];

  // 每頁最多顯示 10 位
  const PAGE_SIZE = 10;


  for (
    const [key, groupRows]
    of sortedGroups
  ) {
    const splitIndex =
      key.lastIndexOf("|");

    const weekRange =
      key.slice(
        0,
        splitIndex
      );

    const bossName =
      key.slice(
        splitIndex + 1
      );

    const weekText =
      weekRange === currentWeek
        ? "本週"
        : "下週";


    for (
      let start = 0;
      start < groupRows.length;
      start += PAGE_SIZE
    ) {
      const chunk =
        groupRows.slice(
          start,
          start + PAGE_SIZE
        );


      let listText = "";


      chunk.forEach(
        (row, index) => {

          const discordName =
            row[2] ||
            "未知成員";

          const characterName =
            row[3] ||
            "未命名角色";

          const job =
            row[4] || "-";

          const level =
            row[5] || "-";

          const power =
            row[6] || "-";

          const times =
            parseTimes(
              row[8]
            )
              .map(
                item =>
                  `${item.day.replace(
                    "星期",
                    "週"
                  )}${item.time}`
              )
              .join("、");

          const note =
            row[9] || "";


          listText +=
            `**${start + index + 1}. ${characterName}**｜${job}｜Lv.${level}｜表功 ${power}\n` +
            `👤 ${discordName}\n` +
            `🕒 ${times || "未填寫時段"}`;


          if (
            note &&
            note !== "無"
          ) {
            listText +=
              `\n📝 ${note}`;
          }


          listText +=
            "\n\n";
        }
      );


      const embed =
        new EmbedBuilder()
          .setColor(
            "#3498DB"
          )
          .setTitle(
            `📋 EtheReal｜全部突襲名單`
          )
          .setDescription(
            `📅 **${weekText}｜${weekRange}**\n` +
            `${getBossEmoji(
              bossName
            )} **${bossName}｜共 ${groupRows.length} 人**\n\n` +
            listText
          );


      pages.push(
        embed
      );
    }
  }


  return pages;
}

// ==============================
// 全部名單分頁按鈕
// ==============================

function buildAllListNavigation(
  currentPage,
  totalPages
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "raid_manager_all_prev"
        )
        .setLabel(
          "◀ 上一頁"
        )
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(
          currentPage <= 0
        ),

      new ButtonBuilder()
        .setCustomId(
          "raid_manager_all_next"
        )
        .setLabel(
          "下一頁 ▶"
        )
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(
          currentPage >=
          totalPages - 1
        ),

      new ButtonBuilder()
        .setCustomId(
          "raid_manager_all_close"
        )
        .setLabel(
          "關閉"
        )
        .setStyle(
          ButtonStyle.Danger
        )
    );
}

// ==============================
// 首頁
// ==============================

function buildManagerEmbed() {
  const currentWeek =
    getCurrentRaidWeekRange();

  const nextWeek =
    getNextRaidWeekRange();

  return new EmbedBuilder()
    .setColor("#F1C40F")
    .setTitle(
      "⚔️ EtheReal｜突襲排團管理"
    )
    .setDescription(
      "請先選擇要查看的週次。\n\n" +

      `📅 **本週**\n${currentWeek}\n\n` +

      `⏭️ **下週**\n${nextWeek}\n\n` +

      "選擇週次後，再選擇突襲王與時段。\n" +
      "只要下週已經有人報名，就可以立即查看下週名單。"
    )
    .setFooter({
      text:
        "僅供管理員排團使用"
    });
}


// ==============================
// 選完週次
// ==============================

function buildWeekEmbed(
  weekRange
) {
  const current =
    getCurrentRaidWeekRange();

  const type =
    weekRange === current
      ? "本週"
      : "下週";

  return new EmbedBuilder()
    .setColor("#F1C40F")
    .setTitle(
      `⚔️ EtheReal｜${type}突襲名單`
    )
    .setDescription(
      `📅 **${weekRange}**\n\n` +
      "請選擇要查看的突襲王。"
    );
}


// ==============================
// 王統計
// ==============================

function buildBossStatsEmbed(
  weekRange,
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

  if (
    ranked.length > 0
  ) {
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
      `📅 **${weekRange}**\n\n` +

      `👥 報名角色：**${rows.length} 人**\n\n` +

      `🔥 **人數最多時段**\n${rankingText}\n\n` +

      "請使用下方選單查看指定時段的詳細名單。"
    );
}


// ==============================
// 詳細名單
//
// 試算表：
// B = Discord ID → row[1]
// C = Discord 名稱 → row[2]
// D = 角色名稱 → row[3]
// E = 職業 → row[4]
// F = 等級 → row[5]
// G = 常駐表功 → row[6]
// ==============================

function buildTimeDetailEmbed(
  weekRange,
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
        `📅 **${weekRange}**\n` +
        `👥 可參加：**${rows.length} 人**`
      );

  rows
    .slice(0, 25)
    .forEach(
      (row, index) => {

        const discordName =
          row[2] || "未知成員";

        const characterName =
          row[3] || "未命名角色";

        const job =
          row[4] || "-";

        const level =
          row[5] || "-";

        const power =
          row[6] || "-";

        const note =
          row[9] || "";

        let value =
          `👤 ${discordName}`;

        if (
          note &&
          note !== "無"
        ) {
          value +=
            `\n📝 ${note}`;
        }

        embed.addFields({
          name:
            `${index + 1}. ${characterName}｜${job}｜Lv.${level}｜表功 ${power}`,

          value,

          inline: false
        });
      }
    );

  if (
    rows.length > 25
  ) {
    embed.setFooter({
      text:
        `目前顯示前 25 人，共 ${rows.length} 人`
    });
  }

  return embed;
}


// ==============================
// 權限
// ==============================

function hasManagerPermission(
  interactionOrMessage
) {
  return (
    interactionOrMessage.member
      ?.permissions
      ?.has("ManageGuild") ||
    false
  );
}


// ==============================
// 啟動
// ==============================

function setupRaidManager(client) {

  // ============================
  // -突襲名單
  // ============================

  client.on(
    "messageCreate",
    async message => {

      if (
        message.author.bot
      ) {
        return;
      }

      if (
        !message.guild
      ) {
        return;
      }

      if (
        message.content.trim() !==
        "-突襲名單"
      ) {
        return;
      }

      if (
        !hasManagerPermission(
          message
        )
      ) {
        return message.reply(
          "❌ 只有管理員可以使用突襲排團功能。"
        );
      }

     const weekBossOptions =
  await buildWeekBossOptions();

if (
  weekBossOptions.length === 0
) {
  return message.reply({
    content:
      "目前本週與下週都沒有突襲報名資料。"
  });
}

return message.reply({
  embeds: [
    new EmbedBuilder()
      .setColor(
        "#F1C40F"
      )
      .setTitle(
        "⚔️ EtheReal｜突襲名單"
      )
      .setDescription(
        "請先選擇「週次＋突襲王」。"
      )
  ],

components: [
  buildWeekBossSelect(
    weekBossOptions
  ),

  buildAllListButton()
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

        // ==============================
// 查看全部名單
// ==============================

if (
  interaction.isButton() &&
  interaction.customId ===
    "raid_manager_all_list"
) {
  if (
    !hasManagerPermission(
      interaction
    )
  ) {
    return interaction.reply({
      content:
        "❌ 只有管理員可以查看全部突襲名單。",
      ephemeral:
        true
    });
  }


  const pages =
    await buildAllRaidListPages();


  if (
    pages.length === 0
  ) {
    return interaction.reply({
      content:
        "目前本週與下週都沒有有效的突襲報名。",
      ephemeral:
        true
    });
  }


  raidAllListSessions.set(
    interaction.user.id,
    {
      pages,
      page: 0
    }
  );


  pages[0].setFooter({
    text:
      `第 1 / ${pages.length} 頁`
  });


  return interaction.reply({
    embeds: [
      pages[0]
    ],

    components: [
      buildAllListNavigation(
        0,
        pages.length
      )
    ],

    ephemeral:
      true
  });
}


// ==============================
// 全部名單：上一頁
// ==============================

if (
  interaction.isButton() &&
  interaction.customId ===
    "raid_manager_all_prev"
) {
  const session =
    raidAllListSessions.get(
      interaction.user.id
    );


  if (
    !session
  ) {
    return interaction.reply({
      content:
        "⚠️ 名單已失效，請重新按「查看全部名單」。",
      ephemeral:
        true
    });
  }


  session.page =
    Math.max(
      0,
      session.page - 1
    );


  const embed =
    session.pages[
      session.page
    ];


  embed.setFooter({
    text:
      `第 ${session.page + 1} / ${session.pages.length} 頁`
  });


  return interaction.update({
    embeds: [
      embed
    ],

    components: [
      buildAllListNavigation(
        session.page,
        session.pages.length
      )
    ]
  });
}


// ==============================
// 全部名單：下一頁
// ==============================

if (
  interaction.isButton() &&
  interaction.customId ===
    "raid_manager_all_next"
) {
  const session =
    raidAllListSessions.get(
      interaction.user.id
    );


  if (
    !session
  ) {
    return interaction.reply({
      content:
        "⚠️ 名單已失效，請重新按「查看全部名單」。",
      ephemeral:
        true
    });
  }


  session.page =
    Math.min(
      session.pages.length - 1,
      session.page + 1
    );


  const embed =
    session.pages[
      session.page
    ];


  embed.setFooter({
    text:
      `第 ${session.page + 1} / ${session.pages.length} 頁`
  });


  return interaction.update({
    embeds: [
      embed
    ],

    components: [
      buildAllListNavigation(
        session.page,
        session.pages.length
      )
    ]
  });
}


// ==============================
// 全部名單：關閉
// ==============================

if (
  interaction.isButton() &&
  interaction.customId ===
    "raid_manager_all_close"
) {
  raidAllListSessions.delete(
    interaction.user.id
  );


  return interaction.update({
    content:
      "✅ 已關閉全部突襲名單。",

    embeds: [],

    components: []
  });
}
        // =====================
// 開始排團按鈕
// =====================

if (
  interaction.isButton() &&
  interaction.customId ===
    "raid_manager_start_team"
) {
  if (
    !hasManagerPermission(
      interaction
    )
  ) {
    return interaction.reply({
      content:
        "❌ 只有管理員可以使用排團功能。",
      ephemeral:
        true
    });
  }

  const selected =
    raidManagerSelections.get(
      interaction.user.id
    );

  if (
    !selected
  ) {
    return interaction.reply({
      content:
        "⚠️ 找不到剛剛選擇的時段，請重新從 `-突襲名單` 選一次。",
      ephemeral:
        true
    });
  }

  const {
    weekRange,
    bossName,
    day,
    time
  } = selected;

  const session =
    await createTeamSession(
      interaction.user.id,
      weekRange,
      bossName,
      day,
      time
    );

  if (
    session.players.length === 0
  ) {
    return interaction.reply({
      content:
        "⚠️ 這個時段目前沒有可排團的角色。",
      ephemeral:
        true
    });
  }

 return interaction.reply({
  embeds: [
    buildTeamEmbed(
      session
    )
  ],

  components:
    buildTeamButtons(
      session
    ),

  ephemeral:
    true
});
}

        if (
          !interaction.isStringSelectMenu()
        ) {
          return;
        }


        // 只處理 raid_manager_
        // 避免和報名系統互相衝突
        if (
          !interaction.customId
            .startsWith(
              "raid_manager_"
            )
        ) {
          return;
        }


        if (
          !hasManagerPermission(
            interaction
          )
        ) {
          return interaction.reply({
            content:
              "❌ 只有管理員可以使用這個功能。",
            ephemeral:
              true
          });
        }

   // ==============================
// 週次＋突襲王
// ==============================

if (
  interaction.customId ===
  "raid_manager_week_boss"
) {
  const value =
    interaction.values[0];

  const splitIndex =
    value.lastIndexOf("|");

  const weekRange =
    value.slice(
      0,
      splitIndex
    );

  const bossName =
    value.slice(
      splitIndex + 1
    );

  const rows =
    await getBossSignups(
      weekRange,
      bossName
    );

  const stats =
    buildTimeStats(
      rows
    );

  if (
    Object.keys(stats).length === 0
  ) {
    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#95A5A6")
          .setTitle(
            `👹 ${bossName}`
          )
          .setDescription(
            `📅 ${weekRange}\n\n目前沒有可選擇的時段。`
          )
      ],

      components: []
    });
  }

  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor("#3498DB")
        .setTitle(
          `👹 ${bossName}｜選擇時段`
        )
        .setDescription(
          `📅 ${weekRange}\n\n請選擇要查看的時段。`
        )
    ],

    components: [
      buildTimeSelect(
        weekRange,
        bossName,
        stats
      )
    ]
  });
}


        // =====================
        // 選週次
        // =====================

        if (
          interaction.customId ===
          "raid_manager_week"
        ) {
          const weekRange =
            interaction.values[0];


          return interaction.update({
            embeds: [
              buildWeekEmbed(
                weekRange
              )
            ],

            components: [
              buildWeekSelect(),
              buildBossSelect(
                weekRange
              )
            ]
          });
        }


        // =====================
        // 選王
        // =====================

        if (
          interaction.customId ===
          "raid_manager_boss"
        ) {
          const value =
            interaction.values[0];

          const splitIndex =
            value.lastIndexOf("|");

          const weekRange =
            value.slice(
              0,
              splitIndex
            );

          const bossName =
            value.slice(
              splitIndex + 1
            );


          const rows =
            await getBossSignups(
              weekRange,
              bossName
            );


          if (
            rows.length === 0
          ) {
            return interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(
                    "#95A5A6"
                  )
                  .setTitle(
                    `👹 ${bossName}｜報名統計`
                  )
                  .setDescription(
                    `📅 **${weekRange}**\n\n` +
                    "目前這一期這隻王還沒有人報名。"
                  )
              ],

              components: [
                buildWeekSelect(),
                buildBossSelect(
                  weekRange
                )
              ]
            });
          }


          const stats =
            buildTimeStats(
              rows
            );


          if (
            Object.keys(stats)
              .length === 0
          ) {
            return interaction.update({
              embeds: [
                buildBossStatsEmbed(
                  weekRange,
                  bossName,
                  rows,
                  stats
                )
              ],

              components: [
                buildWeekSelect(),
                buildBossSelect(
                  weekRange
                )
              ]
            });
          }


          return interaction.update({
            embeds: [
              buildBossStatsEmbed(
                weekRange,
                bossName,
                rows,
                stats
              )
            ],

            components: [
              buildWeekSelect(),

              buildBossSelect(
                weekRange
              ),

              buildTimeSelect(
                weekRange,
                bossName,
                stats
              )
            ]
          });
        }


        // =====================
        // 選時段
        // =====================

        if (
          interaction.customId ===
          "raid_manager_time"
        ) {
          const value =
            interaction.values[0];

          /*
            value 格式：

            2026/09/15～2026/09/21
            |龍王
            |星期五
            |22:00
          */

          const parts =
            value.split("|");

          const weekRange =
            parts[0];

          const bossName =
            parts[1];

          const day =
            parts[2];

          const time =
            parts[3];


          const rows =
            await getBossSignups(
              weekRange,
              bossName
            );


          const available =
            rows.filter(
              row => {
                const times =
                  parseTimes(
                    row[8]
                  );

                return times.some(
                  item =>
                    item.day === day &&
                    item.time === time
                );
              }
            );


          const stats =
            buildTimeStats(
              rows
            );


          raidManagerSelections.set(
  interaction.user.id,
  {
    weekRange,
    bossName,
    day,
    time
  }
);

return interaction.update({
  embeds: [
    buildTimeDetailEmbed(
      weekRange,
      bossName,
      day,
      time,
      available
    )
  ],

  components: [
    buildWeekSelect(),

    buildBossSelect(
      weekRange
    ),

    buildTimeSelect(
      weekRange,
      bossName,
      stats
    ),

    buildStartTeamButton(
      weekRange,
      bossName,
      day,
      time
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
          }).catch(
            () => {}
          );
        } else {
          await interaction.reply({
            content:
              "❌ 讀取突襲名單時發生錯誤。",
            ephemeral:
              true
          }).catch(
            () => {}
          );
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
