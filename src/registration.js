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
const { google } = require("googleapis");

const REGISTER_ROLE_ID = "1487394336462209144";
const REGISTER_CHANNEL_ID = "1487061918182015096";
const REGISTER_LOG_CHANNEL_ID = "1529519154439258334";
const CHARACTER_SHEET_NAME = "角色登記";

const JOBS = [
  "英雄",
  "聖騎士",
  "黑騎士",
  "冰雷",
  "火毒",
  "主教",
  "箭神",
  "神射手",
  "夜使者",
  "暗影神偷",
  "拳霸",
  "槍神"
];

function createSheetsClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    privateKey,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  return google.sheets({ version: "v4", auth });
}

function createRegisterPanel(member) {
  const embed = new EmbedBuilder()
    .setColor("#8E7CC3")
    .setTitle("🍁 EtheReal 角色登記")
    .setDescription(
      `${member ? `${member}，歡迎加入 EtheReal！\n\n` : ""}` +
      "請點擊下方按鈕完成角色登記。登記後，機器人會自動幫你修改伺服器暱稱。"
    )
    .addFields({
      name: "暱稱格式",
      value: "角色名稱/等級職業/其他角色等級職業\n例如：晴晴兒/155冰雷/120主教"
    })
    .setFooter({ text: "資料會同步至 Google 試算表的「角色登記」分頁" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("character_register_start")
      .setLabel("登記角色")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function createJobSelect() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("character_register_job")
    .setPlaceholder("請選擇主要職業")
    .addOptions(JOBS.map(job => ({ label: job, value: job })));

  return new ActionRowBuilder().addComponents(menu);
}

function createRegisterModal(job) {
  const modal = new ModalBuilder()
    .setCustomId(`character_register_modal:${job}`)
    .setTitle(`角色登記｜${job}`);

  const nameInput = new TextInputBuilder()
    .setCustomId("character_name")
    .setLabel("角色名稱")
    .setPlaceholder("例如：晴晴兒")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  const levelInput = new TextInputBuilder()
    .setCustomId("character_level")
    .setLabel("角色等級")
    .setPlaceholder("例如：155")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(3);

  const extraInput = new TextInputBuilder()
    .setCustomId("character_extra")
    .setLabel("其他角色（選填）")
    .setPlaceholder("例如：120主教/100夜使者")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(80);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(levelInput),
    new ActionRowBuilder().addComponents(extraInput)
  );

  return modal;
}

async function ensureCharacterSheet(sheets, spreadsheetId) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = metadata.data.sheets?.some(
    sheet => sheet.properties?.title === CHARACTER_SHEET_NAME
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: CHARACTER_SHEET_NAME } } }]
      }
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${CHARACTER_SHEET_NAME}!A1:I1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "GuildID",
        "Discord ID",
        "Discord名稱",
        "角色名稱",
        "角色等級",
        "主要職業",
        "其他角色",
        "完整暱稱",
        "最後更新"
      ]]
    }
  });
}

async function saveCharacterRegistration(sheets, spreadsheetId, data) {
  await ensureCharacterSheet(sheets, spreadsheetId);

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CHARACTER_SHEET_NAME}!A2:I`
  });

  const rows = result.data.values || [];
  const rowIndex = rows.findIndex(
    row => row[0] === data.guildId && row[1] === data.userId
  );

  const values = [[
    data.guildId,
    data.userId,
    data.discordName,
    data.characterName,
    data.level,
    data.job,
    data.extraCharacters,
    data.nickname,
    data.updatedAt
  ]];

  if (rowIndex >= 0) {
    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${CHARACTER_SHEET_NAME}!A${sheetRow}:I${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${CHARACTER_SHEET_NAME}!A:I`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values }
    });
  }
}

async function sendRegistrationLog(interaction, data) {
  const channel = interaction.guild.channels.cache.get(REGISTER_LOG_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor("#57F287")
    .setTitle("✅ 角色登記完成")
    .setThumbnail(interaction.user.displayAvatarURL({ extension: "png", size: 256 }))
    .addFields(
      { name: "Discord 成員", value: `${interaction.user}`, inline: true },
      { name: "角色名稱", value: data.characterName, inline: true },
      { name: "主要角色", value: `${data.level}${data.job}`, inline: true },
      {
        name: "其他角色",
        value: data.extraCharacters || "無",
        inline: false
      },
      { name: "完整暱稱", value: data.nickname, inline: false }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

function setupRegistration(client) {
  const sheets = createSheetsClient();
  const spreadsheetId = process.env.SHEET_ID;

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      const hadRole = oldMember.roles.cache.has(REGISTER_ROLE_ID);
      const hasRole = newMember.roles.cache.has(REGISTER_ROLE_ID);
      if (hadRole || !hasRole) return;

      const channel = newMember.guild.channels.cache.get(REGISTER_CHANNEL_ID);
      if (!channel?.isTextBased()) return;

      await channel.send(createRegisterPanel(newMember));
    } catch (error) {
      console.error("角色登記面板發送失敗：", error);
    }
  });

  client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return;
    if (!["-登記角色", "-角色登記"].includes(message.content.trim())) return;

    await message.channel.send(createRegisterPanel(message.member));
  });

  client.on("interactionCreate", async interaction => {
    try {
      if (interaction.isButton() && interaction.customId === "character_register_start") {
        if (!interaction.member.roles.cache.has(REGISTER_ROLE_ID)) {
          await interaction.reply({
            content: "你需要先在規章公告領取成員身分組，才能登記角色。",
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: "請先選擇你的主要職業：",
          components: [createJobSelect()],
          ephemeral: true
        });
        return;
      }

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "character_register_job"
      ) {
        const selectedJob = interaction.values[0];
        await interaction.showModal(createRegisterModal(selectedJob));
        return;
      }

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith("character_register_modal:")
      ) {
        await interaction.deferReply({ ephemeral: true });

        const job = interaction.customId.split(":")[1];
        const characterName = interaction.fields.getTextInputValue("character_name").trim();
        const levelText = interaction.fields.getTextInputValue("character_level").trim();
        const extraCharacters = interaction.fields
          .getTextInputValue("character_extra")
          .trim()
          .replace(/^\/+|\/+$/g, "");

        if (!/^\d{1,3}$/.test(levelText)) {
          await interaction.editReply("角色等級只能填入 1～3 位數字，請重新登記。");
          return;
        }

        const level = Number(levelText);
        if (level < 1 || level > 300) {
          await interaction.editReply("角色等級請填入 1～300 之間的數字。");
          return;
        }

        const fullNickname = [
          characterName,
          `${level}${job}`,
          extraCharacters
        ].filter(Boolean).join("/");

        const nickname = fullNickname.slice(0, 32);
        let nicknameChanged = true;
        let nicknameError = "";

        try {
          await interaction.member.setNickname(nickname, "完成角色登記");
        } catch (error) {
          nicknameChanged = false;
          nicknameError = "機器人權限或身分組順位不足，因此無法自動改名。";
          console.error("角色登記改暱稱失敗：", error);
        }

        const updatedAt = new Date().toLocaleString("zh-TW", {
          timeZone: "Asia/Taipei"
        });

        const data = {
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          discordName: interaction.user.username,
          characterName,
          level,
          job,
          extraCharacters,
          nickname,
          updatedAt
        };

        await saveCharacterRegistration(sheets, spreadsheetId, data);
        await sendRegistrationLog(interaction, data);

        const truncatedNotice = fullNickname.length > 32
          ? "\n⚠️ Discord 暱稱上限為 32 字，因此已自動截短。"
          : "";
        const nicknameNotice = nicknameChanged
          ? `\n✅ 暱稱已修改為：**${nickname}**`
          : `\n⚠️ ${nicknameError}`;

        await interaction.editReply(
          `角色登記完成！${nicknameNotice}${truncatedNotice}\n📄 資料已同步至 Google 試算表。`
        );
      }
    } catch (error) {
      console.error("角色登記互動處理失敗：", error);

      const message = "角色登記時發生錯誤，請稍後再試，或通知管理員查看 Northflank Log。";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    }
  });
}

module.exports = { setupRegistration };
