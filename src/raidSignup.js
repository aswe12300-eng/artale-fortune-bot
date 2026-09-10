const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const { google } = require("googleapis");

// ==============================
// 基本設定
// ==============================

const RAID_CHANNEL_ID = "1546602217371467786";
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

// 暫存報名流程
const signupSessions = new Map();


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
  const now = getTaipeiDate();
  const day = now.getDay();

  let diffToTuesday;

  if (day === 0) {
    // 星期日
    diffToTuesday = -5;
  } else if (day === 1) {
    // 星期一
    diffToTuesday = -6;
  } else {
    // 星期二～星期六
    diffToTuesday = 2 - day;
  }

  const tuesday = new Date(now);

  tuesday.setHours(
    0,
    0,
    0,
    0
  );

  tuesday.setDate(
    now.getDate() + diffToTuesday
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
// 下週：再往後 7 天
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
// 從原本的報名面板取得週次
// ==============================

function getWeekFromInteraction(interaction) {
  const description =
    interaction.message
      ?.embeds?.[0]
      ?.description || "";

  const match =
    description.match(
      /(\d{4}\/\d{2}\/\d{2}～\d{4}\/\d{2}\/\d{2})/
    );

  if (match) {
    return match[1];
  }

  return null;
}


// ==============================
// 報名截止
//
// 週次：星期二～星期一
// 截止：星期日 24:00
// ＝ 星期一 00:00
// ==============================

function getSignupDeadline(weekRange) {
  const parts =
    weekRange.split("～");

  if (parts.length !== 2) {
    return null;
  }

  // 週次結束日期本身就是星期一
  return parseYmd(parts[1]);
}

function isSignupOpen(weekRange) {
  const deadline =
    getSignupDeadline(
      weekRange
    );

  if (!deadline) {
    return false;
  }

  return (
    getTaipeiDate() <
    deadline
  );
}

function getDeadlineText(weekRange) {
  const deadline =
    getSignupDeadline(
      weekRange
    );

  if (!deadline) {
    return "週日 24:00";
  }

  const sunday =
    new Date(deadline);

  sunday.setDate(
    sunday.getDate() - 1
  );

  return (
    `${formatDate(sunday)} 24:00`
  );
}


// ==============================
// 報名面板
// ==============================

function getSignupPanelEmbed(
  weekRange,
  panelType = "current"
) {
  const title =
    panelType === "next"
      ? "⚔️ EtheReal｜下週突襲王報名"
      : "⚔️ EtheReal｜本週突襲王報名";

  return new EmbedBuilder()
    .setColor("#9B59FF")
    .setTitle(title)
    .setDescription(
      `📅 **報名週次：${weekRange}**\n` +
      `⏰ **報名截止：${getDeadlineText(weekRange)}**\n\n` +

      "請點下方按鈕填寫可以參加的突襲王與時段。\n\n" +

      "一個 Discord 帳號可以登記多隻角色，" +
      "每隻角色都會各自保留一筆報名資料。\n\n" +

      "📝 **我要報名**：新增一隻角色\n" +
      "✏️ **修改報名**：選擇角色後修改\n" +
      "❌ **取消報名**：取消指定角色\n" +
      "📋 **我的報名**：查看這一期所有角色"
    )
    .setFooter({
      text:
        "星期日 24:00 截止｜截止後無法新增、修改或取消"
    });
}


// ==============================
// 主面板按鈕
// ==============================

function getSignupPanelButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "raid_signup_start"
        )
        .setLabel("我要報名")
        .setEmoji("📝")
        .setStyle(
          ButtonStyle.Success
        ),

      new ButtonBuilder()
        .setCustomId(
          "raid_signup_edit"
        )
        .setLabel("修改報名")
        .setEmoji("✏️")
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          "raid_signup_cancel"
        )
        .setLabel("取消報名")
        .setEmoji("❌")
        .setStyle(
          ButtonStyle.Danger
        ),

      new ButtonBuilder()
        .setCustomId(
          "raid_signup_view"
        )
        .setLabel("我的報名")
        .setEmoji("📋")
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}


// ==============================
// 基本資料 Modal
// ==============================

function buildBasicInfoModal(
  mode = "new",
  existingRow = null
) {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `raid_signup_modal_${mode}`
      )
      .setTitle(
        mode === "edit"
          ? "修改突襲王報名"
          : "突襲王報名"
      );

  const characterName =
    new TextInputBuilder()
      .setCustomId(
        "character_name"
      )
      .setLabel(
        "角色名稱"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(30);

  const job =
    new TextInputBuilder()
      .setCustomId("job")
      .setLabel(
        "職業（例如：冰雷、主教、英雄）"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(30);

  const level =
    new TextInputBuilder()
      .setCustomId("level")
      .setLabel("等級")
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(5);

  const power =
    new TextInputBuilder()
      .setCustomId("power")
      .setLabel("常駐表功")
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setPlaceholder(
        "例如：32500 或 3.25萬"
      )
      .setMaxLength(30);

  const note =
    new TextInputBuilder()
      .setCustomId("note")
      .setLabel(
        "備註（沒有可留白）"
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(false)
      .setMaxLength(200);


  // 修改模式，自動填入原資料
  if (existingRow) {
    if (existingRow[3]) {
      characterName.setValue(
        String(
          existingRow[3]
        ).slice(0, 30)
      );
    }

    if (existingRow[4]) {
      job.setValue(
        String(
          existingRow[4]
        ).slice(0, 30)
      );
    }

    if (existingRow[5]) {
      level.setValue(
        String(
          existingRow[5]
        ).slice(0, 5)
      );
    }

    if (existingRow[6]) {
      power.setValue(
        String(
          existingRow[6]
        ).slice(0, 30)
      );
    }

    if (existingRow[9]) {
      note.setValue(
        String(
          existingRow[9]
        ).slice(0, 200)
      );
    }
  }


  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(
        characterName
      ),

    new ActionRowBuilder()
      .addComponents(
        job
      ),

    new ActionRowBuilder()
      .addComponents(
        level
      ),

    new ActionRowBuilder()
      .addComponents(
        power
      ),

    new ActionRowBuilder()
      .addComponents(
        note
      )
  );

  return modal;
}


// ==============================
// 選王
// ==============================

function buildBossSelect() {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_signup_bosses"
      )
      .setPlaceholder(
        "選擇想打的王（可複選）"
      )
      .setMinValues(1)
      .setMaxValues(4)
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
// 時間
// ==============================

function buildTimeOptions(days) {
  const times = [
    "09:00",
    "12:00",
    "18:00",
    "20:00",
    "22:00"
  ];

  const options = [];

  for (const day of days) {
    for (const time of times) {
      options.push({
        label:
          `${day} ${time}`,

        value:
          `${day}|${time}`
      });
    }
  }

  return options;
}


// ==============================
// 星期二～星期五
// ==============================

function buildTimeSelect1() {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_signup_times_1"
      )
      .setPlaceholder(
        "星期二～五：選擇可打時段"
      )
      .setMinValues(1)
      .setMaxValues(21)
      .addOptions(
        {
          label:
            "星期二～五都無法參加",
          value:
            "NONE"
        },

        ...buildTimeOptions([
          "星期二",
          "星期三",
          "星期四",
          "星期五"
        ])
      );

  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 星期六～星期一
// ==============================

function buildTimeSelect2() {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "raid_signup_times_2"
      )
      .setPlaceholder(
        "星期六～一：選擇可打時段"
      )
      .setMinValues(1)
      .setMaxValues(16)
      .addOptions(
        {
          label:
            "星期六～一都無法參加",
          value:
            "NONE"
        },

        ...buildTimeOptions([
          "星期六",
          "星期日",
          "星期一"
        ])
      );

  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 整理時間文字
// ==============================

function formatTimes(values) {
  const order = [
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
    "星期日",
    "星期一"
  ];

  const map = {};

  for (const value of values) {
    if (
      value === "NONE"
    ) {
      continue;
    }

    const [
      day,
      time
    ] = value.split("|");

    if (!map[day]) {
      map[day] = [];
    }

    map[day].push(time);
  }

  return order
    .filter(
      day =>
        map[day]?.length
    )
    .map(
      day =>
        `${day}：${map[day].join("、")}`
    )
    .join("\n");
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
// 指定週次＋指定 Discord
// 找全部有效角色
// ==============================

async function findAllWeekSignups(
  userId,
  weekRange
) {
  const rows =
    await getRaidRows();

  return rows
    .map(
      (row, index) => ({
        rowNumber:
          index + 2,

        row
      })
    )
    .filter(
      ({ row }) =>
        row[0] === weekRange &&
        row[1] === userId &&
        row[11] !== "已取消"
    );
}


// ==============================
// 找指定角色
// ==============================

async function findWeekSignup(
  userId,
  weekRange,
  characterName
) {
  const signups =
    await findAllWeekSignups(
      userId,
      weekRange
    );

  return (
    signups.find(
      item =>
        item.row[3] ===
        characterName
    ) || null
  );
}


// ==============================
// 儲存報名
// ==============================

async function saveSignup(
  userId,
  data
) {
  const week =
    data.weekRange;

  const rowValues = [
    week,

    userId,

    data.discordName || "",

    data.characterName || "",

    data.job || "",

    data.level || "",

    data.power || "",

    (data.bosses || [])
      .join("、"),

    data.timesText || "",

    data.note || "",

    new Date()
      .toLocaleString(
        "zh-TW",
        {
          timeZone:
            "Asia/Taipei"
        }
      ),

    "已報名"
  ];


  // 修改角色時，用原角色名找原本資料
  const lookupCharacter =
    data.mode === "edit" &&
    data.editingCharacterName
      ? data.editingCharacterName
      : data.characterName;


  const existing =
    await findWeekSignup(
      userId,
      week,
      lookupCharacter
    );


  // 已存在 → 更新
  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId:
        SHEET_ID,

      range:
        `${RAID_SHEET_NAME}!A${existing.rowNumber}:L${existing.rowNumber}`,

      valueInputOption:
        "RAW",

      requestBody: {
        values: [
          rowValues
        ]
      }
    });

    return "updated";
  }


  // 新角色 → 新增
  await sheets.spreadsheets.values.append({
    spreadsheetId:
      SHEET_ID,

    range:
      `${RAID_SHEET_NAME}!A:L`,

    valueInputOption:
      "RAW",

    insertDataOption:
      "INSERT_ROWS",

    requestBody: {
      values: [
        rowValues
      ]
    }
  });

  return "created";
}


// ==============================
// 取消指定角色
// ==============================

async function cancelSignup(
  userId,
  weekRange,
  characterName
) {
  const existing =
    await findWeekSignup(
      userId,
      weekRange,
      characterName
    );

  if (!existing) {
    return false;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId:
      SHEET_ID,

    range:
      `${RAID_SHEET_NAME}!L${existing.rowNumber}`,

    valueInputOption:
      "RAW",

    requestBody: {
      values: [
        ["已取消"]
      ]
    }
  });

  return true;
}


// ==============================
// 角色選單
// ==============================

function buildCharacterSelect(
  customId,
  signups,
  placeholder
) {
  const options =
    signups
      .slice(0, 25)
      .map(
        ({ row }) => ({
          label:
            `${row[3] || "未命名"}｜${row[4] || "未知職業"} Lv.${row[5] || "-"}`.slice(
              0,
              100
            ),

          value:
            String(
              row[3] || ""
            ).slice(
              0,
              100
            ),

          description:
            `表功 ${row[6] || "-"}｜${row[7] || "未選王"}`.slice(
              0,
              100
            )
        })
      );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(
        placeholder
      )
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 我的報名
// ==============================

function signupSummaryEmbed(
  signups,
  weekRange
) {
  const embed =
    new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle(
        "📋 我的突襲王報名"
      )
      .setDescription(
        `📅 **週次：${weekRange}**\n` +
        `共 **${signups.length}** 隻角色已報名`
      );

  signups
    .slice(0, 25)
    .forEach(
      ({ row }, index) => {
        embed.addFields({
          name:
            `${index + 1}. 🎮 ${row[3] || "未命名角色"}`,

          value:
            `🧙 ${row[4] || "-"}｜Lv.${row[5] || "-"}｜表功 ${row[6] || "-"}\n` +
            `👹 ${row[7] || "-"}\n` +
            `🕒 ${row[8] || "-"}\n` +
            `📝 ${row[9] || "無"}`,

          inline:
            false
        });
      }
    );

  if (
    signups.length > 25
  ) {
    embed.setFooter({
      text:
        `目前顯示前 25 隻，共 ${signups.length} 隻角色`
    });
  }

  return embed;
}


// ==============================
// 截止提示
// ==============================

function closedMessage(
  weekRange
) {
  return (
    "⛔ 本期突襲王報名已截止。\n\n" +

    `📅 週次：**${weekRange}**\n` +

    `⏰ 截止：**${getDeadlineText(weekRange)}**\n\n` +

    "截止後無法新增、修改或取消報名。"
  );
}


// ==============================
// 啟動
// ==============================

function setupRaidSignup(client) {

  // ============================
  // 建立報名面板
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

      const command =
        message.content.trim();


      if (
        command !== "-建立突襲報名" &&
        command !== "-建立下週突襲報名"
      ) {
        return;
      }


      if (
        !message.member.permissions.has(
          "ManageGuild"
        )
      ) {
        return message.reply(
          "❌ 只有管理員可以建立突襲王報名面板。"
        );
      }


      const channel =
        message.guild.channels.cache.get(
          RAID_CHANNEL_ID
        );


      if (!channel) {
        return message.reply(
          "❌ 找不到突襲王報名頻道，請確認頻道 ID。"
        );
      }


      const isNext =
        command ===
        "-建立下週突襲報名";


      const weekRange =
        isNext
          ? getNextRaidWeekRange()
          : getCurrentRaidWeekRange();


      // ★ 不清除任何舊資料
      await channel.send({
        embeds: [
          getSignupPanelEmbed(
            weekRange,
            isNext
              ? "next"
              : "current"
          )
        ],

        components: [
          getSignupPanelButtons()
        ]
      });


      return message.reply(
        `✅ 已建立${isNext ? "下週" : "本週"}突襲王報名面板。\n` +
        `📅 報名週次：${weekRange}\n` +
        `⏰ 截止：${getDeadlineText(weekRange)}\n\n` +
        "📌 原本試算表資料已保留，不會清除。"
      );
    }
  );


  // ============================
  // Discord 互動
  // ============================

  client.on(
    "interactionCreate",
    async interaction => {
      try {

        // ========================
        // 按鈕
        // ========================

        if (
          interaction.isButton()
        ) {

          const weekRange =
            getWeekFromInteraction(
              interaction
            );


          if (!weekRange) {
            return interaction.reply({
              content:
                "❌ 找不到這個報名面板的週次，請重新建立報名面板。",
              ephemeral:
                true
            });
          }


          // =====================
          // 我要報名
          // =====================

          if (
            interaction.customId ===
            "raid_signup_start"
          ) {

            if (
              !isSignupOpen(
                weekRange
              )
            ) {
              return interaction.reply({
                content:
                  closedMessage(
                    weekRange
                  ),
                ephemeral:
                  true
              });
            }


            signupSessions.set(
              interaction.user.id,
              {
                mode:
                  "new",

                weekRange
              }
            );


            return interaction.showModal(
              buildBasicInfoModal(
                "new"
              )
            );
          }


          // =====================
          // 修改報名
          // =====================

          if (
            interaction.customId ===
            "raid_signup_edit"
          ) {

            if (
              !isSignupOpen(
                weekRange
              )
            ) {
              return interaction.reply({
                content:
                  closedMessage(
                    weekRange
                  ),
                ephemeral:
                  true
              });
            }


            const signups =
              await findAllWeekSignups(
                interaction.user.id,
                weekRange
              );


            if (
              signups.length === 0
            ) {
              return interaction.reply({
                content:
                  "❌ 這一期你還沒有報名資料，請先使用「我要報名」。",
                ephemeral:
                  true
              });
            }


            // 記住這個選單是哪一週
            signupSessions.set(
              interaction.user.id,
              {
                action:
                  "select_edit",

                weekRange
              }
            );


            return interaction.reply({
              content:
                `### ✏️ 選擇要修改的角色\n📅 ${weekRange}`,

              components: [
                buildCharacterSelect(
                  "raid_signup_edit_character",
                  signups,
                  "選擇要修改的角色"
                )
              ],

              ephemeral:
                true
            });
          }


          // =====================
          // 取消報名
          // =====================

          if (
            interaction.customId ===
            "raid_signup_cancel"
          ) {

            if (
              !isSignupOpen(
                weekRange
              )
            ) {
              return interaction.reply({
                content:
                  closedMessage(
                    weekRange
                  ),
                ephemeral:
                  true
              });
            }


            const signups =
              await findAllWeekSignups(
                interaction.user.id,
                weekRange
              );


            if (
              signups.length === 0
            ) {
              return interaction.reply({
                content:
                  "❌ 找不到這一期的有效報名資料。",
                ephemeral:
                  true
              });
            }


            signupSessions.set(
              interaction.user.id,
              {
                action:
                  "select_cancel",

                weekRange
              }
            );


            return interaction.reply({
              content:
                `### ❌ 選擇要取消的角色\n📅 ${weekRange}\n\n選擇後會直接取消該角色。`,

              components: [
                buildCharacterSelect(
                  "raid_signup_cancel_character",
                  signups,
                  "選擇要取消的角色"
                )
              ],

              ephemeral:
                true
            });
          }


          // =====================
          // 我的報名
          // =====================

          if (
            interaction.customId ===
            "raid_signup_view"
          ) {

            await interaction.deferReply({
              ephemeral:
                true
            });


            const signups =
              await findAllWeekSignups(
                interaction.user.id,
                weekRange
              );


            if (
              signups.length === 0
            ) {
              return interaction.editReply(
                "📭 這一期目前沒有你的突襲王報名資料。"
              );
            }


            return interaction.editReply({
              embeds: [
                signupSummaryEmbed(
                  signups,
                  weekRange
                )
              ]
            });
          }
        }


        // ========================
        // Modal
        // ========================

        if (
          interaction.isModalSubmit()
        ) {

          if (
            interaction.customId !==
              "raid_signup_modal_new" &&
            interaction.customId !==
              "raid_signup_modal_edit"
          ) {
            return;
          }


          const oldSession =
            signupSessions.get(
              interaction.user.id
            );


          if (
            !oldSession ||
            !oldSession.weekRange
          ) {
            return interaction.reply({
              content:
                "⚠️ 報名流程已逾時，請重新操作。",
              ephemeral:
                true
            });
          }


          const weekRange =
            oldSession.weekRange;


          if (
            !isSignupOpen(
              weekRange
            )
          ) {
            signupSessions.delete(
              interaction.user.id
            );

            return interaction.reply({
              content:
                closedMessage(
                  weekRange
                ),
              ephemeral:
                true
            });
          }


          const session = {
            ...oldSession,

            mode:
              interaction.customId
                .endsWith("_edit")
                ? "edit"
                : "new",

            weekRange,

            discordName:
              interaction.member
                ?.displayName ||
              interaction.user.username,

            characterName:
              interaction.fields
                .getTextInputValue(
                  "character_name"
                )
                .trim(),

            job:
              interaction.fields
                .getTextInputValue(
                  "job"
                )
                .trim(),

            level:
              interaction.fields
                .getTextInputValue(
                  "level"
                )
                .trim(),

            power:
              interaction.fields
                .getTextInputValue(
                  "power"
                )
                .trim(),

            note:
              interaction.fields
                .getTextInputValue(
                  "note"
                )
                .trim(),

            bosses: [],
            times1: [],
            times2: []
          };


          signupSessions.set(
            interaction.user.id,
            session
          );


          return interaction.reply({
            content:
              `### 👹 第 2 步：選擇想打的王\n` +
              `📅 ${weekRange}\n\n` +
              "可以一次選多個。",

            components: [
              buildBossSelect()
            ],

            ephemeral:
              true
          });
        }


        // ========================
        // 下拉選單
        // ========================

        if (
          interaction.isStringSelectMenu()
        ) {

          // =====================
          // 修改：選角色
          // =====================

          if (
            interaction.customId ===
            "raid_signup_edit_character"
          ) {

            const selectSession =
              signupSessions.get(
                interaction.user.id
              );


            if (
              !selectSession ||
              !selectSession.weekRange
            ) {
              return interaction.update({
                content:
                  "⚠️ 操作已逾時，請重新按「修改報名」。",
                components: []
              });
            }


            const weekRange =
              selectSession.weekRange;


            if (
              !isSignupOpen(
                weekRange
              )
            ) {
              signupSessions.delete(
                interaction.user.id
              );

              return interaction.update({
                content:
                  closedMessage(
                    weekRange
                  ),
                components: []
              });
            }


            const characterName =
              interaction.values[0];


            const existing =
              await findWeekSignup(
                interaction.user.id,
                weekRange,
                characterName
              );


            if (!existing) {
              return interaction.update({
                content:
                  "❌ 找不到這隻角色的報名資料。",
                components: []
              });
            }


            signupSessions.set(
              interaction.user.id,
              {
                mode:
                  "edit",

                weekRange,

                editingCharacterName:
                  characterName
              }
            );


            return interaction.showModal(
              buildBasicInfoModal(
                "edit",
                existing.row
              )
            );
          }


          // =====================
          // 取消：選角色
          // =====================

          if (
            interaction.customId ===
            "raid_signup_cancel_character"
          ) {

            const selectSession =
              signupSessions.get(
                interaction.user.id
              );


            if (
              !selectSession ||
              !selectSession.weekRange
            ) {
              return interaction.update({
                content:
                  "⚠️ 操作已逾時，請重新按「取消報名」。",
                components: []
              });
            }


            const weekRange =
              selectSession.weekRange;


            if (
              !isSignupOpen(
                weekRange
              )
            ) {
              signupSessions.delete(
                interaction.user.id
              );

              return interaction.update({
                content:
                  closedMessage(
                    weekRange
                  ),
                components: []
              });
            }


            const characterName =
              interaction.values[0];


            const success =
              await cancelSignup(
                interaction.user.id,
                weekRange,
                characterName
              );


            signupSessions.delete(
              interaction.user.id
            );


            return interaction.update({
              content:
                success
                  ? `✅ 已取消 **${characterName}** 的突襲王報名。\n📅 ${weekRange}\n\n其他角色不受影響。`
                  : "❌ 找不到這隻角色的有效報名資料。",

              components: []
            });
          }


          // =====================
          // 一般報名流程
          // =====================

          const session =
            signupSessions.get(
              interaction.user.id
            );


          if (
            !session ||
            !session.weekRange
          ) {
            return interaction.reply({
              content:
                "⚠️ 報名流程已逾時，請重新按「我要報名」或「修改報名」。",
              ephemeral:
                true
            });
          }


          if (
            !isSignupOpen(
              session.weekRange
            )
          ) {
            signupSessions.delete(
              interaction.user.id
            );

            return interaction.update({
              content:
                closedMessage(
                  session.weekRange
                ),
              components: []
            });
          }


          // =====================
          // 選王
          // =====================

          if (
            interaction.customId ===
            "raid_signup_bosses"
          ) {

            session.bosses =
              interaction.values;


            signupSessions.set(
              interaction.user.id,
              session
            );


            return interaction.update({
              content:
                "### 🕒 第 3 步：星期二～五\n" +
                `📅 ${session.weekRange}\n\n` +
                "請直接勾選真正可以參加的「星期＋時間」。\n\n" +
                "如果星期二～五都不行，請選「星期二～五都無法參加」。",

              components: [
                buildTimeSelect1()
              ]
            });
          }


          // =====================
          // 星期二～五
          // =====================

          if (
            interaction.customId ===
            "raid_signup_times_1"
          ) {

            const selected =
              interaction.values;


            if (
              selected.includes(
                "NONE"
              ) &&
              selected.length > 1
            ) {
              return interaction.reply({
                content:
                  "❌「都無法參加」不能和其他時段一起選。",
                ephemeral:
                  true
              });
            }


            session.times1 =
              selected;


            signupSessions.set(
              interaction.user.id,
              session
            );


            return interaction.update({
              content:
                "### 🕒 第 4 步：星期六、日、一\n" +
                `📅 ${session.weekRange}\n\n` +
                "請勾選可以參加的時段。\n\n" +
                "如果星期六～一都不行，請選「星期六～一都無法參加」。",

              components: [
                buildTimeSelect2()
              ]
            });
          }


          // =====================
          // 星期六～一
          // =====================

          if (
            interaction.customId ===
            "raid_signup_times_2"
          ) {

            const selected =
              interaction.values;


            if (
              selected.includes(
                "NONE"
              ) &&
              selected.length > 1
            ) {
              return interaction.reply({
                content:
                  "❌「都無法參加」不能和其他時段一起選。",
                ephemeral:
                  true
              });
            }


            session.times2 =
              selected;


            const allTimes = [
              ...(session.times1 || []),
              ...(session.times2 || [])
            ].filter(
              value =>
                value !== "NONE"
            );


            if (
              allTimes.length === 0
            ) {
              return interaction.reply({
                content:
                  "❌ 至少要選擇一個可以參加的時段。",
                ephemeral:
                  true
              });
            }


            session.timesText =
              formatTimes(
                allTimes
              );


            await interaction.deferUpdate();


            const result =
              await saveSignup(
                interaction.user.id,
                session
              );


            signupSessions.delete(
              interaction.user.id
            );


            const doneEmbed =
              new EmbedBuilder()
                .setColor(
                  "#2ECC71"
                )
                .setTitle(
                  result === "updated"
                    ? "✅ 突襲王報名已更新"
                    : "✅ 突襲王報名完成"
                )
                .setDescription(
                  `📅 **${session.weekRange}**\n\n` +

                  `🎮 **角色：** ${session.characterName}\n` +

                  `🧙 **職業：** ${session.job}\n` +

                  `🏅 **等級：** ${session.level}\n` +

                  `⚔️ **常駐表功：** ${session.power}\n` +

                  `👹 **想打的王：** ${session.bosses.join("、")}\n\n` +

                  `🕒 **可打時段：**\n${session.timesText}\n\n` +

                  `📝 **備註：** ${session.note || "無"}`
                )
                .setFooter({
                  text:
                    "資料已同步至 Google 試算表"
                });


            return interaction.editReply({
              content: "",

              embeds: [
                doneEmbed
              ],

              components: []
            });
          }
        }


      } catch (error) {

        console.error(
          "突襲王報名系統錯誤：",
          error
        );


        if (
          interaction.deferred ||
          interaction.replied
        ) {

          await interaction.followUp({
            content:
              "❌ 系統發生錯誤，請稍後再試。",
            ephemeral:
              true
          }).catch(
            () => {}
          );

        } else {

          await interaction.reply({
            content:
              "❌ 系統發生錯誤，請稍後再試。",
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
  setupRaidSignup
};
