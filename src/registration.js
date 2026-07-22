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
  "英雄", "聖騎士", "黑騎士", "冰雷", "火毒", "主教",
  "箭神", "神射手", "夜使者", "暗影神偷", "拳霸", "槍神"
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
  function createRegisterPanel(member) {
  const embed = new EmbedBuilder()
    .setColor("#9B59FF")
    .setTitle("🧚 新核心成員加入")
    .setDescription(
      `大家熱烈歡迎 ${member} 成為 **EtheReal** 的戰鬥精靈！✨\n\n` +

      `新夥伴請務必完成以下動作：\n\n` +

      `**1️⃣ 📝 完成角色登記**\n\n` +
      `請點擊下方的 **【📝 登記角色】** 按鈕，完成角色資料登記。\n\n` +
      `完成後，Bot 將會：\n` +
      `✅ 建立角色資料\n` +
      `✅ 同步至公會 Google 試算表\n` +
      `✅ 自動修改伺服器暱稱\n\n` +
      `暱稱格式：角色名稱 / 等級職業 / 其他角色\n` +
      `範例：晴晴兒 /168冰雷 /135主教\n\n` +
      `⚠️ 若你的身分組高於機器人，Discord 將無法讓 Bot 自動改名，請依照 Bot 提供的格式自行修改。\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `**2️⃣ 王團重要連結**\n\n` +
      `🔹 王團報名： <#1493861592151097344>\n` +
      `🔹 每週佈告欄： <#1493595715992289452>\n` +
      `🔹 當日王團提醒： <#1489135137135525908>\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `**3️⃣ 🤖 公會功能**\n\n` +
      `⊹┊-🤖-ethereal指令中心： <#1526335381954498630>\n\n` +
      `想快速了解公會 Bot 的所有功能嗎？\n` +
      `請前往 Bot 指令中心查看完整教學與最新公告。\n\n` +
      `目前已開放：\n` +
      `🌟 活躍系統\n` +
      `🔮 占卜系統\n` +
      `🎵 Jockie Music\n\n` +
      `⚠️ 請依照各功能說明，至對應頻道使用相關指令，避免影響其他成員聊天。\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `**4️⃣ 🎁 公會福利**\n\n` +
      `💋 公會好康： <#1526299439428534423>\n\n` +
      `✨ EtheReal 擁有專屬公會名牌，歡迎大家一起使用！\n\n` +
      `🔍 紙娃娃搜尋關鍵字：**EtheReal**\n\n` +
      `⚠️ 購買前請注意：\n` +
      `每個部位皆有 **兩種版本**：\n` +
      `🔹 坐下沒有造型\n` +
      `🔹 坐下有造型\n\n` +
      `📌 建議購買前先預覽角色「坐下」的動作，再選擇自己喜歡的版本。\n\n` +
      `🏷️ Discord 也提供公會專屬標籤，歡迎大家一起使用。\n\n` +
      `🍁 歡迎加入 EtheReal～ 🍁`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({
      text: "請點擊下方按鈕完成角色登記"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("character_register_start")
      .setLabel("登記角色")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("character_register_start")
      .setLabel("登記角色")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function createJobSelect(customId = "character_register_job", placeholder = "請選擇主要職業") {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
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
        "GuildID", "Discord ID", "Discord名稱", "角色名稱", "角色等級",
        "主要職業", "其他角色", "完整暱稱", "最後更新"
      ]]
    }
  });
}

async function getCharacterRegistration(sheets, spreadsheetId, guildId, userId) {
  await ensureCharacterSheet(sheets, spreadsheetId);
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CHARACTER_SHEET_NAME}!A2:I`
  });
  const rows = result.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === guildId && row[1] === userId);
  if (rowIndex < 0) return null;
  const row = rows[rowIndex];
  return {
    rowNumber: rowIndex + 2,
    guildId: row[0] || "",
    userId: row[1] || "",
    discordName: row[2] || "",
    characterName: row[3] || "",
    level: Number(row[4]) || 0,
    job: row[5] || "",
    extraCharacters: row[6] || "",
    nickname: row[7] || "",
    updatedAt: row[8] || ""
  };
}

async function saveCharacterRegistration(sheets, spreadsheetId, data) {
  await ensureCharacterSheet(sheets, spreadsheetId);
  const existing = await getCharacterRegistration(
    sheets, spreadsheetId, data.guildId, data.userId
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

  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${CHARACTER_SHEET_NAME}!A${existing.rowNumber}:I${existing.rowNumber}`,
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

function buildNickname(data) {
  const full = [
    data.characterName,
    `${data.level}${data.job}`,
    data.extraCharacters
  ].filter(Boolean).join("/");
  return { full, nickname: full.slice(0, 32) };
}

async function trySetNickname(member, nickname, reason) {
  try {
    await member.setNickname(nickname, reason);
    return { changed: true, message: `✅ 暱稱已修改為：**${nickname}**` };
  } catch (error) {
    console.error("角色系統改暱稱失敗：", error);
    return {
      changed: false,
      message:
        "⚠️ Discord 無法自動修改你的暱稱。\n" +
        "可能是你為管理員、伺服器擁有者，或你的最高身分組高於機器人。\n" +
        `請自行修改為：**${nickname}**`
    };
  }
}

async function sendRegistrationLog(interaction, data, action = "角色登記完成") {
  const channel = interaction.guild.channels.cache.get(REGISTER_LOG_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor("#57F287")
    .setTitle(`✅ ${action}`)
    .setThumbnail(interaction.user.displayAvatarURL({ extension: "png", size: 256 }))
    .addFields(
      { name: "Discord 成員", value: `${interaction.user}`, inline: true },
      { name: "角色名稱", value: data.characterName, inline: true },
      { name: "主要角色", value: `${data.level}${data.job}`, inline: true },
      { name: "其他角色", value: data.extraCharacters || "無", inline: false },
      { name: "完整暱稱", value: data.nickname, inline: false }
    )
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

function formatCharacterEmbed(user, data) {
  return new EmbedBuilder()
    .setColor("#58A6FF")
    .setTitle(`🍁 ${data.characterName} 的角色資料`)
    .setThumbnail(user.displayAvatarURL({ extension: "png", size: 256 }))
    .addFields(
      { name: "角色名稱", value: data.characterName, inline: true },
      { name: "等級", value: `${data.level}`, inline: true },
      { name: "職業", value: data.job, inline: true },
      { name: "其他角色", value: data.extraCharacters || "無", inline: false },
      { name: "暱稱格式", value: data.nickname || buildNickname(data).nickname, inline: false },
      { name: "最後更新", value: data.updatedAt || "未記錄", inline: false }
    );
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
      if (channel?.isTextBased()) await channel.send(createRegisterPanel(newMember));
    } catch (error) {
      console.error("角色登記面板發送失敗：", error);
    }
  });

  client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return;
    const content = message.content.trim();

    if (["-登記角色", "-角色登記"].includes(content)) {
      await message.channel.send(createRegisterPanel(message.member));
      return;
    }

    if (content === "-我的角色") {
      const data = await getCharacterRegistration(
        sheets, spreadsheetId, message.guild.id, message.author.id
      );
      if (!data) {
        await message.reply("你尚未登記角色，請先輸入 `-登記角色`。");
        return;
      }
      await message.reply({ embeds: [formatCharacterEmbed(message.author, data)] });
      return;
    }

    if (content.startsWith("-更新等級")) {
      const match = content.match(/^-更新等級\s+(\d{1,3})$/);
      if (!match) {
        await message.reply("格式錯誤，請輸入：`-更新等級 161`");
        return;
      }
      const newLevel = Number(match[1]);
      if (newLevel < 1 || newLevel > 300) {
        await message.reply("角色等級請填入 1～300 之間的數字。");
        return;
      }

      const data = await getCharacterRegistration(
        sheets, spreadsheetId, message.guild.id, message.author.id
      );
      if (!data) {
        await message.reply("你尚未登記角色，請先輸入 `-登記角色`。");
        return;
      }

      data.level = newLevel;
      data.discordName = message.author.username;
      data.updatedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
      const names = buildNickname(data);
      data.nickname = names.nickname;
      await saveCharacterRegistration(sheets, spreadsheetId, data);
      const nickResult = await trySetNickname(message.member, data.nickname, "更新角色等級");

      await message.reply(
        `✅ 等級已更新為 **${newLevel}${data.job}**。\n${nickResult.message}\n📄 Google 試算表已同步。`
      );
      return;
    }

    if (["-更新職業", "-更新角色"].includes(content)) {
      const data = await getCharacterRegistration(
        sheets, spreadsheetId, message.guild.id, message.author.id
      );
      if (!data) {
        await message.reply("你尚未登記角色，請先輸入 `-登記角色`。");
        return;
      }
      await message.reply({
        content: "請選擇新的主要職業：",
        components: [createJobSelect("character_update_job", "請選擇新的主要職業")]
      });
    }
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

      if (interaction.isStringSelectMenu() && interaction.customId === "character_register_job") {
        await interaction.showModal(createRegisterModal(interaction.values[0]));
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === "character_update_job") {
        await interaction.deferReply({ ephemeral: true });
        const data = await getCharacterRegistration(
          sheets, spreadsheetId, interaction.guild.id, interaction.user.id
        );
        if (!data) {
          await interaction.editReply("你尚未登記角色，請先輸入 `-登記角色`。");
          return;
        }

        data.job = interaction.values[0];
        data.discordName = interaction.user.username;
        data.updatedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
        const names = buildNickname(data);
        data.nickname = names.nickname;
        await saveCharacterRegistration(sheets, spreadsheetId, data);
        const nickResult = await trySetNickname(interaction.member, data.nickname, "更新主要職業");
        await sendRegistrationLog(interaction, data, "角色職業更新完成");

        await interaction.editReply(
          `✅ 主要職業已更新為 **${data.job}**。\n${nickResult.message}\n📄 Google 試算表已同步。`
        );
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

        const updatedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
        const data = {
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          discordName: interaction.user.username,
          characterName,
          level,
          job,
          extraCharacters,
          nickname: "",
          updatedAt
        };
        const names = buildNickname(data);
        data.nickname = names.nickname;

        await saveCharacterRegistration(sheets, spreadsheetId, data);
        const nickResult = await trySetNickname(interaction.member, data.nickname, "完成角色登記");
        await sendRegistrationLog(interaction, data);

        const truncatedNotice = names.full.length > 32
          ? "\n⚠️ Discord 暱稱上限為 32 字，因此建議暱稱已自動截短。"
          : "";
        await interaction.editReply(
          `✅ 角色登記完成！\n${nickResult.message}${truncatedNotice}\n📄 資料已同步至 Google 試算表。`
        );
      }
    } catch (error) {
      console.error("角色系統處理失敗：", error);
      const text = "角色系統發生錯誤，請稍後再試，或通知管理員查看 Northflank Log。";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(text).catch(() => {});
      } else {
        await interaction.reply({ content: text, ephemeral: true }).catch(() => {});
      }
    }
  });
}

module.exports = { setupRegistration };
