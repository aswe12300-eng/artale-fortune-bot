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

// 暫存正在填寫報名的成員資料
const signupSessions = new Map();


// ==============================
// 取得台灣時間
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
// 取得本週週一～週日
// ==============================

function getWeekRange() {
  const now = getTaipeiDate();

  const day = now.getDay();

  const diffToMonday =
    day === 0
      ? -6
      : 1 - day;

  const monday = new Date(now);

  monday.setDate(
    now.getDate() + diffToMonday
  );

  const sunday = new Date(monday);

  sunday.setDate(
    monday.getDate() + 6
  );

  return `${formatDate(monday)}～${formatDate(sunday)}`;
}


// ==============================
// 報名主面板
// ==============================

function getSignupPanelEmbed() {
  return new EmbedBuilder()

    .setColor("#9B59FF")

    .setTitle(
      "⚔️ EtheReal｜本週突襲王報名"
    )

    .setDescription(
      `📅 **本週週次：${getWeekRange()}**\n\n` +

      "請點下方按鈕填寫本週可以參加的突襲王與時段。\n\n" +

      "📝 **我要報名**：新增本週報名\n" +
      "✏️ **修改報名**：重新填寫本週資料\n" +
      "❌ **取消報名**：取消本週報名\n" +
      "📋 **我的報名**：查看本週資料"
    )

    .setFooter({
      text: "EtheReal 突襲王報名系統"
    });
}


// ==============================
// 主面板按鈕
// ==============================

function getSignupPanelButtons() {
  return new ActionRowBuilder()

    .addComponents(

      new ButtonBuilder()
        .setCustomId("raid_signup_start")
        .setLabel("我要報名")
        .setEmoji("📝")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("raid_signup_edit")
        .setLabel("修改報名")
        .setEmoji("✏️")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("raid_signup_cancel")
        .setLabel("取消報名")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("raid_signup_view")
        .setLabel("我的報名")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Secondary)
    );
}


// ==============================
// 基本資料填寫視窗
// ==============================

function buildBasicInfoModal(mode = "new") {

  const modal = new ModalBuilder()

    .setCustomId(
      `raid_signup_modal_${mode}`
    )

    .setTitle(
      mode === "edit"
        ? "修改突襲王報名"
        : "突襲王報名"
    );


  // 角色名稱

  const characterName =
    new TextInputBuilder()

      .setCustomId("character_name")

      .setLabel("角色名稱")

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(true)

      .setMaxLength(30);


  // 職業

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


  // 等級

  const level =
    new TextInputBuilder()

      .setCustomId("level")

      .setLabel("等級")

      .setStyle(
        TextInputStyle.Short
      )

      .setRequired(true)

      .setMaxLength(5);


  // 常駐表功

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


  // 備註

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


  modal.addComponents(

    new ActionRowBuilder()
      .addComponents(characterName),

    new ActionRowBuilder()
      .addComponents(job),

    new ActionRowBuilder()
      .addComponents(level),

    new ActionRowBuilder()
      .addComponents(power),

    new ActionRowBuilder()
      .addComponents(note)

  );


  return modal;
}


// ==============================
// 選擇突襲王
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
// 建立星期＋時間選項
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

        label: `${day} ${time}`,

        value: `${day}|${time}`

      });

    }

  }


  return options;
}


// ==============================
// 星期一～四
// ==============================

function buildWeekdayTimeSelect() {

  const menu =
    new StringSelectMenuBuilder()

      .setCustomId(
        "raid_signup_times_1"
      )

      .setPlaceholder(
        "星期一～四：選擇可打時段"
      )

      .setMinValues(1)

      .setMaxValues(20)

      .addOptions(
        buildTimeOptions([
          "星期一",
          "星期二",
          "星期三",
          "星期四"
        ])
      );


  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 星期五～日
// ==============================

function buildWeekendTimeSelect() {

  const menu =
    new StringSelectMenuBuilder()

      .setCustomId(
        "raid_signup_times_2"
      )

      .setPlaceholder(
        "星期五～日：選擇可打時段"
      )

      .setMinValues(1)

      .setMaxValues(16)

      .addOptions(

        {
          label:
            "星期五～日都無法參加",

          value: "NONE"
        },

        ...buildTimeOptions([
          "星期五",
          "星期六",
          "星期日"
        ])

      );


  return new ActionRowBuilder()
    .addComponents(menu);
}


// ==============================
// 整理時間格式
// ==============================

function formatTimes(values) {

  const order = [

    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
    "星期日"

  ];


  const map = {};


  for (const value of values) {

    if (value === "NONE") {
      continue;
    }


    const [day, time] =
      value.split("|");


    if (!map[day]) {
      map[day] = [];
    }


    map[day].push(time);

  }


  return order

    .filter(
      day => map[day]?.length
    )

    .map(
      day =>
        `${day}：${map[day].join("、")}`
    )

    .join("\n");
}


// ==============================
// 取得試算表資料
// ==============================

async function getCurrentWeekRows() {

  const res =
    await sheets.spreadsheets.values.get({

      spreadsheetId: SHEET_ID,

      range:
        `${RAID_SHEET_NAME}!A2:L`

    });


  return res.data.values || [];
}


// ==============================
// 找某位成員本週報名
// ==============================

async function findCurrentWeekSignup(
  userId
) {

  const week =
    getWeekRange();


  const rows =
    await getCurrentWeekRows();


  const index =
    rows.findIndex(

      row =>

        row[0] === week &&

        row[1] === userId &&

        row[11] !== "已取消"

    );


  if (index === -1) {
    return null;
  }


  return {

    rowNumber:
      index + 2,

    row:
      rows[index]

  };
}


// ==============================
// 儲存報名
// ==============================

async function saveSignup(
  userId,
  data
) {

  const week =
    getWeekRange();


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


  const existing =
    await findCurrentWeekSignup(
      userId
    );


  // 已報名 → 更新原本那一列

  if (existing) {

    await sheets.spreadsheets.values.update({

      spreadsheetId:
        SHEET_ID,

      range:
        `${RAID_SHEET_NAME}!A${existing.rowNumber}:L${existing.rowNumber}`,

      valueInputOption:
        "RAW",

      requestBody: {

        values:
          [rowValues]

      }

    });


    return "updated";
  }


  // 沒報名 → 新增

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

      values:
        [rowValues]

    }

  });


  return "created";
}


// ==============================
// 取消報名
// ==============================

async function cancelSignup(
  userId
) {

  const existing =
    await findCurrentWeekSignup(
      userId
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
// 我的報名顯示
// ==============================

function signupSummaryEmbed(row) {

  return new EmbedBuilder()

    .setColor("#2ECC71")

    .setTitle(
      "📋 我的本週突襲王報名"
    )

    .addFields(

      {
        name: "📅 週次",
        value: row[0] || "-",
        inline: false
      },

      {
        name: "🎮 角色",
        value: row[3] || "-",
        inline: true
      },

      {
        name: "🧙 職業",
        value: row[4] || "-",
        inline: true
      },

      {
        name: "🏅 等級",
        value: row[5] || "-",
        inline: true
      },

      {
        name: "⚔️ 常駐表功",
        value: row[6] || "-",
        inline: true
      },

      {
        name: "👹 想打的王",
        value: row[7] || "-",
        inline: false
      },

      {
        name: "🕒 可打時段",
        value: row[8] || "-",
        inline: false
      },

      {
        name: "📝 備註",
        value: row[9] || "無",
        inline: false
      },

      {
        name: "✅ 狀態",
        value: row[11] || "-",
        inline: true
      }

    );
}


// ==============================
// 啟動突襲王報名系統
// ==============================

function setupRaidSignup(client) {


  // ============================
  // 管理員建立報名面板
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
        "-建立突襲報名"
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


      await channel.send({

        embeds: [
          getSignupPanelEmbed()
        ],

        components: [
          getSignupPanelButtons()
        ]

      });


      if (
        message.channel.id !==
        RAID_CHANNEL_ID
      ) {

        await message.reply(
          "✅ 已在突襲王報名頻道建立面板。"
        );

      }

    }
  );


  // ============================
  // Discord互動
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


          // 我要報名

          if (
            interaction.customId ===
            "raid_signup_start"
          ) {

            return interaction.showModal(
              buildBasicInfoModal("new")
            );

          }


          // 修改報名

          if (
            interaction.customId ===
            "raid_signup_edit"
          ) {

            const existing =
              await findCurrentWeekSignup(
                interaction.user.id
              );


            if (!existing) {

              return interaction.reply({

                content:
                  "❌ 你本週還沒有報名資料，請先使用「我要報名」。",

                ephemeral: true

              });

            }


            return interaction.showModal(
              buildBasicInfoModal("edit")
            );

          }


          // 取消報名

          if (
            interaction.customId ===
            "raid_signup_cancel"
          ) {

            await interaction.deferReply({
              ephemeral: true
            });


            const success =
              await cancelSignup(
                interaction.user.id
              );


            return interaction.editReply(

              success

                ? "✅ 已取消你本週的突襲王報名。"

                : "❌ 找不到你本週的有效報名資料。"

            );

          }


          // 我的報名

          if (
            interaction.customId ===
            "raid_signup_view"
          ) {

            await interaction.deferReply({
              ephemeral: true
            });


            const existing =
              await findCurrentWeekSignup(
                interaction.user.id
              );


            if (!existing) {

              return interaction.editReply(
                "📭 你本週目前還沒有突襲王報名資料。"
              );

            }


            return interaction.editReply({

              embeds: [
                signupSummaryEmbed(
                  existing.row
                )
              ]

            });

          }

        }


        // ========================
        // 基本資料 Modal
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


          const session = {

            mode:
              interaction.customId
                .endsWith("_edit")
                ? "edit"
                : "new",

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
              "### 👹 第 2 步：選擇想打的王\n" +
              "可以一次選多個。",

            components: [
              buildBossSelect()
            ],

            ephemeral: true

          });

        }


        // ========================
        // 下拉選單
        // ========================

        if (
          interaction.isStringSelectMenu()
        ) {


          const session =
            signupSessions.get(
              interaction.user.id
            );


          if (!session) {

            return interaction.reply({

              content:
                "⚠️ 報名流程已逾時，請重新按「我要報名」。",

              ephemeral: true

            });

          }


          // 選王

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
                "### 🕒 第 3 步：星期一～四\n" +
                "請直接勾選真正可以參加的「星期＋時間」。\n\n" +
                "例如星期二只有 22:00，就只勾「星期二 22:00」。",

              components: [
                buildWeekdayTimeSelect()
              ]

            });

          }


          // 星期一～四

          if (
            interaction.customId ===
            "raid_signup_times_1"
          ) {

            session.times1 =
              interaction.values;


            signupSessions.set(
              interaction.user.id,
              session
            );


            return interaction.update({

              content:
                "### 🕒 第 4 步：星期五～日\n" +
                "勾選可以參加的時段。\n\n" +
                "如果這三天都不行，請選「星期五～日都無法參加」。",

              components: [
                buildWeekendTimeSelect()
              ]

            });

          }


          // 星期五～日

          if (
            interaction.customId ===
            "raid_signup_times_2"
          ) {


            const selected =
              interaction.values;


            if (
              selected.includes("NONE") &&
              selected.length > 1
            ) {

              return interaction.reply({

                content:
                  "❌「都無法參加」不能和其他時段一起選，請重新選擇。",

                ephemeral: true

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

                ephemeral: true

              });

            }


            session.timesText =
              formatTimes(allTimes);


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

                .setColor("#2ECC71")

                .setTitle(

                  result === "updated"

                    ? "✅ 突襲王報名已更新"

                    : "✅ 突襲王報名完成"

                )

                .setDescription(

                  `📅 **${getWeekRange()}**\n\n` +

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

            ephemeral: true

          }).catch(() => {});


        } else {


          await interaction.reply({

            content:
              "❌ 系統發生錯誤，請稍後再試。",

            ephemeral: true

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
  setupRaidSignup
};
