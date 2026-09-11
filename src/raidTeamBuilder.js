const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const { google } = require("googleapis");

// ==============================
// 基本設定
// ==============================

const RAID_SHEET_NAME = "突襲報名";

const RAID_ANNOUNCEMENT_CHANNEL_ID =
  "1547521433654132797";

const SHEET_ID =
  process.env.SHEET_ID;

const GOOGLE_CLIENT_EMAIL =
  process.env.GOOGLE_CLIENT_EMAIL;

const GOOGLE_PRIVATE_KEY =
  process.env.GOOGLE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

const auth =
  new google.auth.JWT(
    GOOGLE_CLIENT_EMAIL,
    null,
    GOOGLE_PRIVATE_KEY,
    [
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  );

const sheets =
  google.sheets({
    version: "v4",
    auth
  });


// ==============================
// 暫存排團資料
// key = 管理員 Discord ID
// ==============================

const teamSessions =
  new Map();


// ==============================
// 讀取試算表
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
// 解析報名時段
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
        .map(v => v.trim())
        .filter(Boolean);

    for (const time of times) {
      result.push({
        day,
        time
      });
    }
  }

  return result;
}


// ==============================
// 找指定週次＋王＋時段的人
// ==============================

async function getAvailablePlayers(
  weekRange,
  bossName,
  day,
  time
) {
  const rows =
    await getRaidRows();

  return rows.filter(row => {

    const rowWeek =
      row[0];

    const bosses =
      String(
        row[7] || ""
      )
        .split("、")
        .map(v => v.trim());

    const status =
      row[11];

    if (
      rowWeek !== weekRange
    ) {
      return false;
    }

    if (
      status === "已取消"
    ) {
      return false;
    }

    if (
      !bosses.includes(
        bossName
      )
    ) {
      return false;
    }

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
}


// ==============================
// 每隊上限
// ==============================

function getTeamLimit(
  bossName
) {
  // 所有隊伍都 6 人
  return 6;
}


// ==============================
// 把試算表 row 轉成角色資料
//
// B Discord ID  row[1]
// C Discord名稱 row[2]
// D 角色名稱    row[3]
// E 職業        row[4]
// F 等級        row[5]
// G 表功        row[6]
// ==============================

function rowToPlayer(
  row
) {
  return {
    discordId:
      row[1] || "",

    discordName:
      row[2] || "未知成員",

    characterName:
      row[3] || "未命名角色",

    job:
      row[4] || "-",

    level:
      row[5] || "-",

    power:
      row[6] || "-"
  };
}


// ==============================
// 建立玩家選單
// ==============================

function buildPlayerSelect(
  session,
  teamName
) {
  const selectedOtherTeams =
    new Set();

  for (
    const [name, players]
    of Object.entries(
      session.teams
    )
  ) {
    if (
      name === teamName
    ) {
      continue;
    }

    for (
      const player of players
    ) {
      selectedOtherTeams.add(
        `${player.discordId}|${player.characterName}`
      );
    }
  }

  const available =
    session.players.filter(
      player =>
        !selectedOtherTeams.has(
          `${player.discordId}|${player.characterName}`
        )
    );

  const currentSelected =
    session.teams[
      teamName
    ] || [];

  const currentKeys =
    new Set(
      currentSelected.map(
        player =>
          `${player.discordId}|${player.characterName}`
      )
    );

  const options =
    available
      .slice(0, 25)
      .map(player => {

        const value =
          `${player.discordId}|${player.characterName}`;

        return {
          label:
            `${player.characterName}｜${player.job}`.slice(
              0,
              100
            ),

          description:
            `${player.discordName}｜Lv.${player.level}｜${player.power}`.slice(
              0,
              100
            ),

          value,

          default:
            currentKeys.has(
              value
            )
        };
      });

  const maxValues =
    Math.min(
      getTeamLimit(
        session.bossName
      ),
      options.length
    );

  if (
    options.length === 0
  ) {
    return null;
  }

  const teamNames =
    Object.keys(
      session.teams
    );

  const teamIndex =
    teamNames.indexOf(
      teamName
    );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        `raid_team_players_${teamIndex}`
      )
      .setPlaceholder(
        `選擇 ${teamName} 成員`
      )
      .setMinValues(0)
      .setMaxValues(
        maxValues
      )
      .addOptions(
        options
      );

  return new ActionRowBuilder()
    .addComponents(
      menu
    );
}


// ==============================
// 建立新團｜輸入自訂團名
// ==============================

function buildCreateTeamModal() {
  const modal =
    new ModalBuilder()
      .setCustomId(
        "raid_team_create_modal"
      )
      .setTitle(
        "建立新的突襲團"
      );

  const teamNameInput =
    new TextInputBuilder()
      .setCustomId(
        "raid_team_name"
      )
      .setLabel(
        "團名"
      )
      .setPlaceholder(
        "例如：晴晴出貨團"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(
        true
      )
      .setMinLength(
        1
      )
      .setMaxLength(
        30
      );

  const row =
    new ActionRowBuilder()
      .addComponents(
        teamNameInput
      );

  modal.addComponents(
    row
  );

  return modal;
}

// ==============================
// 建立控制按鈕
// ==============================

function buildTeamButtons(
  session
) {
  const rows = [];

  const teamNames =
    Object.keys(
      session.teams
    );

  const allButtons = [
    new ButtonBuilder()
      .setCustomId(
        "raid_team_create"
      )
      .setLabel(
        "建立新團"
      )
      .setEmoji(
        "➕"
      )
      .setStyle(
        ButtonStyle.Success
      )
  ];

  teamNames.forEach(
    (teamName, index) => {
      allButtons.push(
        new ButtonBuilder()
          .setCustomId(
            `raid_team_edit_${index}`
          )
          .setLabel(
            `編輯 ${teamName}`.slice(0, 80)
          )
          .setStyle(
            ButtonStyle.Primary
          )
      );
    }
  );

  allButtons.push(
    new ButtonBuilder()
      .setCustomId(
        "raid_team_preview"
      )
      .setLabel(
        "預覽公告"
      )
      .setStyle(
        ButtonStyle.Secondary
      )
  );

  allButtons.push(
    new ButtonBuilder()
      .setCustomId(
        "raid_team_publish"
      )
      .setLabel(
        "發布公告"
      )
      .setStyle(
        ButtonStyle.Success
      )
  );

  for (
    let i = 0;
    i < allButtons.length;
    i += 5
  ) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          allButtons.slice(
            i,
            i + 5
          )
        )
    );
  }

  return rows;
}


// ==============================
// 排團主畫面
// ==============================

function buildTeamEmbed(
  session
) {
  const embed =
    new EmbedBuilder()
      .setColor(
        "#9B59B6"
      )
      .setTitle(
        `⚔️ ${session.bossName}｜排團`
      )
      .setDescription(
        `📅 ${session.weekRange}\n` +
        `🕒 ${session.day} ${session.time}\n` +
        `👥 可參加角色：${session.players.length} 人`
      );

  const teamNames =
  Object.keys(
    session.teams
  );

  for (
    const teamName
    of teamNames
  ) {
    const players =
      session.teams[
        teamName
      ] || [];

    let text =
      "尚未選擇成員";

    if (
      players.length > 0
    ) {
      text =
        players
          .map(
            (player, index) =>
              `${index + 1}. ${player.characterName}｜${player.job}｜Lv.${player.level}\n` +
              `   👤 ${player.discordName}`
          )
          .join("\n");
    }

    embed.addFields({
      name:
        `${teamName}｜${players.length}/6`,

      value:
        text,

      inline:
        false
    });
  }

  return embed;
}


// ==============================
// 公告預覽
// ==============================

function buildAnnouncementEmbed(
  session
) {
  const embed =
    new EmbedBuilder()
      .setColor(
        "#E67E22"
      )
      .setTitle(
        `⚔️ EtheReal｜${session.bossName}`
      )
      .setDescription(
        `📅 ${session.weekRange}\n` +
        `🕒 ${session.day} ${session.time}`
      );

 const teamNames =
  Object.keys(
    session.teams
  );

  for (
    const teamName
    of teamNames
  ) {
    const players =
      session.teams[
        teamName
      ] || [];

    let text =
      "尚未安排";

    if (
      players.length > 0
    ) {
      text =
        players
          .map(
            (player, index) =>
              `${index + 1}. **${player.characterName}**｜${player.job}｜Lv.${player.level}\n` +
              `👤 ${player.discordName}｜<@${player.discordId}>`
          )
          .join("\n");
    }

    embed.addFields({
      name:
        `${teamName}｜${players.length}/6`,

      value:
        text,

      inline:
        false
    });
  }

  embed.setFooter({
    text:
      "請團員準時集合"
  });

  return embed;
}


// ==============================
// 建立排團 session
// ==============================

async function createTeamSession(
  userId,
  weekRange,
  bossName,
  day,
  time
) {
  const rows =
    await getAvailablePlayers(
      weekRange,
      bossName,
      day,
      time
    );

  const players =
    rows.map(
      rowToPlayer
    );

 const teams = {};

  const session = {
    weekRange,
    bossName,
    day,
    time,
    players,
    teams
  };

  teamSessions.set(
    userId,
    session
  );

  return session;
}


// ==============================
// 啟動模組
// ==============================

function setupRaidTeamBuilder(
  client
) {

  client.on(
    "interactionCreate",
    async interaction => {

      try {

        // ======================
        // 按鈕
        // ======================

        if (
          interaction.isButton()
        ) {

          if (
            !interaction.customId
              .startsWith(
                "raid_team_"
              )
          ) {
            return;
          }


          const session =
            teamSessions.get(
              interaction.user.id
            );


          if (
            !session
          ) {
            return interaction.reply({
              content:
                "⚠️ 排團資料已失效，請重新從突襲名單開啟排團。",
              ephemeral:
                true
            });
          }

// ==============================
// 建立新團
// ==============================

if (
  interaction.customId ===
  "raid_team_create"
) {
  return interaction.showModal(
    buildCreateTeamModal()
  );
}


          // 編輯隊伍
          if (
            interaction.customId
              .startsWith(
                "raid_team_edit_"
              )
          ) {
            const teamIndex =
              Number(
                interaction.customId.replace(
                  "raid_team_edit_",
                  ""
                )
              );

            const teamNames =
              Object.keys(
                session.teams
              );

            const teamName =
              teamNames[
                teamIndex
              ];

            if (
              !teamName
            ) {
              return interaction.reply({
                content:
                  "❌ 找不到這個團隊，請重新開啟排團畫面。",
                ephemeral:
                  true
              });
            }

            const select =
              buildPlayerSelect(
                session,
                teamName
              );

            if (
              !select
            ) {
              return interaction.reply({
                content:
                  "⚠️ 目前沒有可選擇的角色。",
                ephemeral:
                  true
              });
            }

            return interaction.reply({
              content:
                `請選擇 ${teamName} 成員：`,

              components: [
                select
              ],

              ephemeral:
                true
            });
          }


          // 預覽
          if (
            interaction.customId ===
            "raid_team_preview"
          ) {
            return interaction.reply({
              embeds: [
                buildAnnouncementEmbed(
                  session
                )
              ],

              ephemeral:
                true
            });
          }


          // 發布
          if (
            interaction.customId ===
            "raid_team_publish"
          ) {

           const teamNames =
             Object.keys(
               session.teams
             );

            const total =
              teamNames.reduce(
                (sum, teamName) =>
                  sum +
                  (
                    session.teams[
                      teamName
                    ]?.length || 0
                  ),
                0
              );


            if (
              total === 0
            ) {
              return interaction.reply({
                content:
                  "❌ 尚未安排任何成員，不能發布公告。",
                ephemeral:
                  true
              });
            }


            const channel =
              await client.channels.fetch(
                RAID_ANNOUNCEMENT_CHANNEL_ID
              );


            if (
              !channel ||
              !channel.isTextBased()
            ) {
              return interaction.reply({
                content:
                  "❌ 找不到打王公告頻道。",
                ephemeral:
                  true
              });
            }


            // ==============================
// 整理本場所有 Discord 成員
// 同一個人有多隻角色也只標記一次
// ==============================

const allPlayers =
  teamNames.flatMap(
    teamName =>
      session.teams[teamName] || []
  );

const uniqueDiscordIds =
  [
    ...new Set(
      allPlayers
        .map(player => player.discordId)
        .filter(Boolean)
    )
  ];

const mentions =
  uniqueDiscordIds
    .map(id => `<@${id}>`)
    .join(" ");


// ==============================
// 發布正式公告
// ==============================

await channel.send({
  content:
    mentions.length > 0
      ? `📣 **本場突襲成員請注意！**\n${mentions}`
      : "📣 **本場突襲公告**",

  embeds: [
    buildAnnouncementEmbed(
      session
    )
  ],

  allowedMentions: {
    users:
      uniqueDiscordIds
  }
});


            return interaction.reply({
              content:
                `✅ 已發布 ${session.bossName} 打王公告到 <#${RAID_ANNOUNCEMENT_CHANNEL_ID}>。`,
              ephemeral:
                true
            });
          }

        }


        // ==============================
// 建立新團｜接收團名
// ==============================

if (
  interaction.isModalSubmit() &&
  interaction.customId ===
    "raid_team_create_modal"
) {
  const session =
    teamSessions.get(
      interaction.user.id
    );

  if (
    !session
  ) {
    return interaction.reply({
      content:
        "⚠️ 排團資料已失效，請重新從突襲名單開啟排團。",
      ephemeral:
        true
    });
  }

  const teamName =
    interaction.fields
      .getTextInputValue(
        "raid_team_name"
      )
      .trim();

  if (
    !teamName
  ) {
    return interaction.reply({
      content:
        "❌ 團名不能是空白。",
      ephemeral:
        true
    });
  }

  if (
    session.teams[
      teamName
    ]
  ) {
    return interaction.reply({
      content:
        `❌ 已經有一個「${teamName}」了，請換一個團名。`,
      ephemeral:
        true
    });
  }

  session.teams[
    teamName
  ] = [];

  teamSessions.set(
    interaction.user.id,
    session
  );

  return interaction.reply({
    content:
      `✅ 已建立新團：**${teamName}**`,
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


        // ======================
        // 玩家選單
        // ======================

        if (
          interaction.isStringSelectMenu()
        ) {

          if (
            !interaction.customId
              .startsWith(
                "raid_team_players_"
              )
          ) {
            return;
          }


          const session =
            teamSessions.get(
              interaction.user.id
            );


          if (
            !session
          ) {
            return interaction.reply({
              content:
                "⚠️ 排團資料已失效，請重新開啟排團。",
              ephemeral:
                true
            });
          }


          const teamIndex =
            Number(
              interaction.customId.replace(
                "raid_team_players_",
                ""
              )
            );

          const teamNames =
            Object.keys(
              session.teams
            );

          const teamName =
            teamNames[
              teamIndex
            ];

          if (
            !teamName
          ) {
            return interaction.reply({
              content:
                "❌ 找不到這個團隊，請重新開啟排團畫面。",
              ephemeral:
                true
            });
          }


          const chosenKeys =
            new Set(
              interaction.values
            );


          const selectedPlayers =
            session.players.filter(
              player =>
                chosenKeys.has(
                  `${player.discordId}|${player.characterName}`
                )
            );


          if (
            selectedPlayers.length >
            getTeamLimit(
              session.bossName
            )
          ) {
            return interaction.reply({
              content:
                "❌ 每隊最多只能選 6 人。",
              ephemeral:
                true
            });
          }


          session.teams[
            teamName
          ] =
            selectedPlayers;


          teamSessions.set(
            interaction.user.id,
            session
          );


          return interaction.update({
            content:
              `✅ ${teamName} 已更新，共 ${selectedPlayers.length}/6 人。`,

            components: []
          });
        }


      } catch (error) {

        console.error(
          "排團系統錯誤：",
          error
        );


        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content:
              "❌ 排團時發生錯誤。",
            ephemeral:
              true
          }).catch(
            () => {}
          );
        } else {
          await interaction.reply({
            content:
              "❌ 排團時發生錯誤。",
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
  setupRaidTeamBuilder,
  createTeamSession,
  buildTeamEmbed,
  buildTeamButtons
};
