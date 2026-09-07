const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

// ==============================
// 頻道 / 身分組 ID
// ==============================

// 新人報到
const WELCOME_CHANNEL_ID = "1487033416330383432";

// 規章公告
const RULES_CHANNEL_ID = "1487074463563649164";

// 外援公告
const SUPPORT_INFO_CHANNEL_ID = "1546515478586073211";

// 王團外援身分組
const SUPPORT_ROLE_ID = "1546515986570543176";

// 幹部身分組
const STAFF_ROLE_ID = "1487011622798102660";

// ==============================
// 新人加入分流面板
// ==============================

function createWelcomePanel(member) {
  const embed = new EmbedBuilder()
    .setColor("#9B59FF")
    .setTitle("🍁 歡迎加入 EtheReal 🍁")
    .setDescription(
      `歡迎 ${member} 加入我們的大家庭！✨\n\n` +

      `請先選擇你的身分類型：\n\n` +

     `🍁 **公會新成員**\n` +
`已加入 **EtheReal 公會**的夥伴，請點擊下方【🍁 公會新成員】前往規章公告。\n\n` +

`📜 **如何取得正式公會身分？**\n` +
`① 詳細閱讀公會規章\n` +
`② 在規章公告下方點擊 👍\n` +
`③ 即可取得【ㄅㄇ戰鬥精靈】正式公會成員身分組\n` +
`✨ 取得後將開放完整公會相關頻道！\n\n` +

`⚔️ **王團外援**\n` +
`受邀前來協助王團、一起打王，暫時不加入公會的夥伴。\n` +
`請點擊下方【⚔️ 王團外援】前往外援報到，領取外援身分即可開放王團相關頻道。\n\n` +
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
      text: "請點擊下方按鈕前往對應區域"
    });

  const row = new ActionRowBuilder().addComponents(

    // 公會新成員 → 規章公告
    new ButtonBuilder()
      .setLabel("公會新成員")
      .setEmoji("🍁")
      .setStyle(ButtonStyle.Link)
      .setURL(
        `https://discord.com/channels/${member.guild.id}/${RULES_CHANNEL_ID}`
      ),

    // 王團外援 → 外援公告
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


// ==============================
// 外援公告面板
// ==============================

function createSupportPanel(guildId) {
  const embed = new EmbedBuilder()
    .setColor("#F1C40F")
    .setTitle("⚔️ EtheReal 王團外援")
    .setDescription(
      `謝謝你願意幫助我們一起攻略王團！🫶\n\n` +

      `不論是偶爾支援、固定跟團，\n` +
      `都非常感謝你願意成為我們王團的一份力量！\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `🔥 **目前王團**\n\n` +

      `🐦 普拉\n` +
      `🔥 炎魔\n` +
      `👹 困難拉圖斯\n` +
      `🐉 龍王\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `⚔️ **取得「王團外援」身分後**\n\n` +

      `即可進入王團相關區域，查看：\n\n` +

      `📋 王團報名\n` +
      `📢 王團公告\n` +
      `🔔 開團通知\n` +
      `💬 王團討論\n` +
      `🎙️ 王團語音\n\n` +

      `━━━━━━━━━━━━━━\n\n` +

      `💜 **如果你喜歡這裡**\n\n` +

      `也非常歡迎正式加入 **EtheReal 公會**！\n\n` +

      `加入公會後除了王團，\n` +
      `還可以一起參與更多活動、聊天、練等與公會福利 ✨\n\n` +

      `未來打王不用再四處找團！\n\n` +

      `🍁 一起打王｜一起練等｜一起出貨 🍁\n\n` +

      `👇 **確認後請點擊下方按鈕取得身分**`
    )
    .setFooter({
      text: "EtheReal｜王團外援系統"
    });


  const row = new ActionRowBuilder().addComponents(

    // 領取外援身分
    new ButtonBuilder()
      .setCustomId("support_role_claim")
      .setLabel("取得王團外援")
      .setEmoji("⚔️")
      .setStyle(ButtonStyle.Success),

    // 想加入公會 → 規章
    new ButtonBuilder()
      .setLabel("我想加入公會")
      .setEmoji("🍁")
      .setStyle(ButtonStyle.Link)
      .setURL(
        `https://discord.com/channels/${guildId}/${RULES_CHANNEL_ID}`
      )
  );


  return {
    embeds: [embed],
    components: [row]
  };
}


// ==============================
// 啟動外援系統
// ==============================

function setupSupportRole(client) {


  // ============================
  // 新成員加入 Discord
  // ============================

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
        "❌ 新人分流訊息發送失敗：",
        error
      );

    }

  });


  // ============================
  // -建立外援公告
  // ============================

  client.on("messageCreate", async message => {

    // 忽略 Bot
    if (message.author.bot) return;

    // 必須在伺服器
    if (!message.guild) return;

    // 指令判斷
    if (
      message.content.trim() !==
      "-建立外援公告"
    ) {
      return;
    }


   // ==========================
// 僅限管理員 / 幹部
// ==========================

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
    "❌ 只有管理員或幹部可以建立外援公告。"
  );

  return;
}

    // ==========================
    // 必須在外援公告頻道使用
    // ==========================

    if (
      message.channel.id !==
      SUPPORT_INFO_CHANNEL_ID
    ) {

      await message.reply(
        `❌ 請到 <#${SUPPORT_INFO_CHANNEL_ID}> 使用這個指令。`
      );

      return;
    }


    try {

      // 發送外援公告
      await message.channel.send(
        createSupportPanel(
          message.guild.id
        )
      );


      // 刪掉管理員輸入的指令
      await message.delete()
        .catch(() => {});


      console.log(
        "✅ 外援公告建立完成"
      );

    } catch (error) {

      console.error(
        "❌ 建立外援公告失敗：",
        error
      );

      await message.reply(
        "❌ 建立外援公告失敗，請檢查 Bot 權限。"
      ).catch(() => {});

    }

  });


  // ============================
  // 外援身分組按鈕
  // ============================

  client.on("interactionCreate", async interaction => {

    try {

      if (
        !interaction.isButton() ||
        interaction.customId !==
          "support_role_claim"
      ) {
        return;
      }


      // 必須在伺服器
      if (!interaction.guild) {
        return;
      }


      // 抓取成員
      const member =
        await interaction.guild.members.fetch(
          interaction.user.id
        );


      // ==========================
      // 已經有外援身分
      // ==========================

      if (
        member.roles.cache.has(
          SUPPORT_ROLE_ID
        )
      ) {

        await interaction.reply({
          content:
            "⚔️ 你已經擁有 **王團外援** 身分囉！",
          ephemeral: true
        });

        return;
      }


      // ==========================
      // 新增外援身分
      // ==========================

      await member.roles.add(
        SUPPORT_ROLE_ID,
        "使用者自行領取王團外援身分組"
      );


      await interaction.reply({
        content:
          "✅ 已成功取得 **王團外援** 身分！\n\n" +
          "王團相關頻道已經為你開放 ⚔️\n" +
          "歡迎一起打王、一起出貨！ 🍁",
        ephemeral: true
      });


    } catch (error) {

      console.error(
        "❌ 外援身分組領取失敗：",
        error
      );


      if (
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
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


// ==============================
// 匯出
// ==============================

module.exports = {
  setupSupportRole,
  createSupportPanel
};
