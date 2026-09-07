const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

// 新人報到
const WELCOME_CHANNEL_ID = "1487033416330383432";

// 規章公告
const RULES_CHANNEL_ID = "1487074463563649164";

// 外援公告
const SUPPORT_INFO_CHANNEL_ID = "1546515478586073211";

// 王團外援身分組
const SUPPORT_ROLE_ID = "1546515986570543176";

function createWelcomePanel(member) {
  const embed = new EmbedBuilder()
    .setColor("#9B59FF")
    .setTitle("🍁 歡迎加入 EtheReal 🍁")
    .setDescription(
      `歡迎 ${member} 加入我們的大家庭！✨\n\n` +

      `加入後請先選擇你的身分類型：\n\n` +

      `🍁 **公會新成員**\n` +
      `已加入 EtheReal 公會的夥伴，請先閱讀公會規章並領取正式會員身分組。\n\n` +

      `⚔️ **王團外援**\n` +
      `受邀前來協助王團、一起打王，暫時不加入公會的夥伴。\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `🔥 **目前公會王團**\n` +
      `🐦 普拉\n` +
      `🔥 炎魔\n` +
      `👹 困難拉圖斯\n` +
      `🐉 龍王\n\n` +

      `🍁 一起打王｜一起練等｜一起出貨 🍁`
    )
    .setThumbnail(
      member.user.displayAvatarURL({
        extension: "png",
        size: 256
      })
    )
    .setFooter({
      text: "請點擊下方按鈕前往對應的身分說明"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("公會新成員")
      .setEmoji("🍁")
      .setStyle(ButtonStyle.Link)
      .setURL(
        `https://discord.com/channels/${member.guild.id}/${RULES_CHANNEL_ID}`
      ),

    new ButtonBuilder()
      .setLabel("王團外援")
      .setEmoji("⚔️")
      .setStyle(ButtonStyle.Link)
      .setURL(
        `https://discord.com/channels/${member.guild.id}/${SUPPORT_INFO_CHANNEL_ID}`
      )
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function createSupportPanel() {
  const embed = new EmbedBuilder()
    .setColor("#F1C40F")
    .setTitle("⚔️ EtheReal 王團外援")
    .setDescription(
      `謝謝你願意幫助我們一起攻略王團！🫶\n\n` +

      `不論是偶爾支援、固定跟團，` +
      `都非常感謝你願意成為我們王團的一份力量。\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `🔥 **取得王團外援身分後，可以查看：**\n\n` +

      `⚔️ 王團報名\n` +
      `📋 每週王團佈告欄\n` +
      `🔔 當日王團通知\n` +
      `💬 王團相關頻道\n` +
      `🎙️ 王團語音頻道\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `💜 **喜歡這裡，也歡迎加入 EtheReal！**\n\n` +

      `成為正式公會成員後，除了王團之外，` +
      `還能一起參與更多公會活動、練等、聊天與福利。\n\n` +

      `以後打王不用再四處找團 ✨\n\n` +

      `🍁 一起打王｜一起練等｜一起出貨 🍁\n\n` +

      `👇 確認後請點擊下方按鈕取得王團外援身分。`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("support_role_claim")
      .setLabel("取得王團外援")
      .setEmoji("⚔️")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setLabel("查看公會規章")
      .setEmoji("🍁")
      .setStyle(ButtonStyle.Link)
      .setURL(
        `https://discord.com/channels/@me/${RULES_CHANNEL_ID}`
      )
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function setupSupportRole(client) {

  // 新成員加入
  client.on("guildMemberAdd", async member => {
    try {
      const channel =
        member.guild.channels.cache.get(
          WELCOME_CHANNEL_ID
        );

      if (!channel?.isTextBased()) {
        return;
      }

      await channel.send(
        createWelcomePanel(member)
      );

    } catch (error) {
      console.error(
        "新人分流訊息發送失敗：",
        error
      );
    }
  });

  // 按鈕處理
  client.on("interactionCreate", async interaction => {
    try {
      if (
        !interaction.isButton() ||
        interaction.customId !==
          "support_role_claim"
      ) {
        return;
      }

      const member = interaction.member;

      if (
        member.roles.cache.has(
          SUPPORT_ROLE_ID
        )
      ) {
        await interaction.reply({
          content:
            "⚔️ 你已經擁有「王團外援」身分組囉！",
          ephemeral: true
        });

        return;
      }

      await member.roles.add(
        SUPPORT_ROLE_ID,
        "使用者自行領取王團外援身分組"
      );

      await interaction.reply({
        content:
          "✅ 已成功取得 **王團外援** 身分組！\n\n" +
          "現在可以前往王團相關頻道囉 ⚔️",
        ephemeral: true
      });

    } catch (error) {
      console.error(
        "外援身分組領取失敗：",
        error
      );

      if (
        interaction.isRepliable() &&
        !interaction.replied
      ) {
        await interaction.reply({
          content:
            "❌ 身分組領取失敗，請通知管理員檢查 Bot 權限。",
          ephemeral: true
        }).catch(() => {});
      }
    }
  });
}

module.exports = {
  setupSupportRole,
  createSupportPanel
};
