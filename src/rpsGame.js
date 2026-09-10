const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const games = new Map();

function getChoiceEmoji(choice) {
  if (choice === "rock") {
    return "✊";
  }

  if (choice === "paper") {
    return "🖐️";
  }

  if (choice === "scissors") {
    return "✌️";
  }

  return "❓";
}

function getChoiceName(choice) {
  if (choice === "rock") {
    return "石頭";
  }

  if (choice === "paper") {
    return "布";
  }

  if (choice === "scissors") {
    return "剪刀";
  }

  return "未知";
}

function getWinner(
  player1Choice,
  player2Choice
) {
  if (
    player1Choice ===
    player2Choice
  ) {
    return "draw";
  }

  if (
    (
      player1Choice === "rock" &&
      player2Choice === "scissors"
    ) ||
    (
      player1Choice === "scissors" &&
      player2Choice === "paper"
    ) ||
    (
      player1Choice === "paper" &&
      player2Choice === "rock"
    )
  ) {
    return "player1";
  }

  return "player2";
}

function buildWaitingEmbed(game) {
  return new EmbedBuilder()
    .setColor("#9B59FF")
    .setTitle(
      "✊ EtheReal｜猜拳挑戰"
    )
    .setDescription(
      `<@${game.player1Id}> 發起了一場猜拳挑戰！\n\n` +
      "誰敢來應戰？😎\n" +
      "**先按先贏！**"
    )
    .setFooter({
      text:
        "2 分鐘內無人應戰，挑戰會自動失效"
    });
}

function buildWaitingButtons(gameId) {
  const row =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `rps_join_${gameId}`
          )
          .setLabel(
            "我要應戰"
          )
          .setEmoji(
            "⚔️"
          )
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            `rps_cancel_${gameId}`
          )
          .setLabel(
            "取消挑戰"
          )
          .setEmoji(
            "❌"
          )
          .setStyle(
            ButtonStyle.Danger
          )
      );

  return row;
}

function buildBattleEmbed(game) {
  const player1Status =
    game.player1Choice
      ? "✅ 已出拳"
      : "⏳ 等待出拳";

  const player2Status =
    game.player2Choice
      ? "✅ 已出拳"
      : "⏳ 等待出拳";

  return new EmbedBuilder()
    .setColor("#F39C12")
    .setTitle(
      "⚔️ 猜拳對決開始！"
    )
    .setDescription(
      `<@${game.player1Id}> **VS** <@${game.player2Id}>\n\n` +
      "雙方請秘密出拳！\n\n" +
      `<@${game.player1Id}>：${player1Status}\n` +
      `<@${game.player2Id}>：${player2Status}`
    )
    .setFooter({
      text:
        "對手看不到你出了什麼"
    });
}

function buildChoiceButtons(gameId) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `rps_choice_${gameId}_rock`
        )
        .setLabel(
          "石頭"
        )
        .setEmoji(
          "✊"
        )
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `rps_choice_${gameId}_scissors`
        )
        .setLabel(
          "剪刀"
        )
        .setEmoji(
          "✌️"
        )
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `rps_choice_${gameId}_paper`
        )
        .setLabel(
          "布"
        )
        .setEmoji(
          "🖐️"
        )
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}

function buildResultEmbed(game) {
  const winner =
    getWinner(
      game.player1Choice,
      game.player2Choice
    );

  let resultText = "";

  if (
    winner === "draw"
  ) {
    resultText =
      "🤝 **平手！**\n\n" +
      "兩個人也太有默契了吧 😂";
  }

  if (
    winner === "player1"
  ) {
    resultText =
      `🏆 <@${game.player1Id}> **獲勝！**`;
  }

  if (
    winner === "player2"
  ) {
    resultText =
      `🏆 <@${game.player2Id}> **獲勝！**`;
  }

  return new EmbedBuilder()
    .setColor(
      winner === "draw"
        ? "#95A5A6"
        : "#F1C40F"
    )
    .setTitle(
      "🎉 猜拳結果"
    )
    .setDescription(
      `<@${game.player1Id}>　` +
      `${getChoiceEmoji(game.player1Choice)} ` +
      `**${getChoiceName(game.player1Choice)}**\n\n` +

      "　　　　**VS**\n\n" +

      `<@${game.player2Id}>　` +
      `${getChoiceEmoji(game.player2Choice)} ` +
      `**${getChoiceName(game.player2Choice)}**\n\n` +

      "━━━━━━━━━━━━━━\n\n" +
      resultText
    );
}

function setupRpsGame(client) {
  client.on(
    "messageCreate",
    async message => {
      if (
        message.author.bot
      ) {
        return;
      }

      if (
        message.content.trim() !==
        "-猜拳"
      ) {
        return;
      }

      const existingGame =
        [...games.values()]
          .find(game =>
            game.player1Id ===
              message.author.id &&
            game.status ===
              "waiting"
          );

      if (
        existingGame
      ) {
        await message.reply(
          "❌ 你目前已經有一場等待應戰的猜拳挑戰。"
        );

        return;
      }

      const gameId =
        `${Date.now()}_${message.author.id}`;

      const game = {
        id: gameId,

        player1Id:
          message.author.id,

        player2Id:
          null,

        player1Choice:
          null,

        player2Choice:
          null,

        status:
          "waiting",

        messageId:
          null,

        channelId:
          message.channel.id,

        timeout:
          null
      };

      const sent =
        await message.channel.send({
          content:
            `<@${message.author.id}> 發起猜拳挑戰！`,

          embeds: [
            buildWaitingEmbed(
              game
            )
          ],

          components: [
            buildWaitingButtons(
              gameId
            )
          ]
        });

      game.messageId =
        sent.id;

      games.set(
        gameId,
        game
      );

      game.timeout =
        setTimeout(
          async () => {
            const currentGame =
              games.get(
                gameId
              );

            if (
              !currentGame ||
              currentGame.status !==
                "waiting"
            ) {
              return;
            }

            games.delete(
              gameId
            );

            try {
              await sent.edit({
                content:
                  "⌛ 猜拳挑戰已失效",

                embeds: [
                  new EmbedBuilder()
                    .setColor(
                      "#95A5A6"
                    )
                    .setTitle(
                      "⌛ 挑戰失效"
                    )
                    .setDescription(
                      `<@${currentGame.player1Id}> 的猜拳挑戰無人應戰。`
                    )
                ],

                components: []
              });
            } catch (error) {
              console.error(
                "猜拳逾時更新失敗：",
                error
              );
            }
          },
          2 * 60 * 1000
        );
    }
  );

  client.on(
    "interactionCreate",
    async interaction => {
      if (
        !interaction.isButton()
      ) {
        return;
      }

      if (
        !interaction.customId.startsWith(
          "rps_"
        )
      ) {
        return;
      }

      if (
        interaction.customId.startsWith(
          "rps_join_"
        )
      ) {
        const gameId =
          interaction.customId.replace(
            "rps_join_",
            ""
          );

        const game =
          games.get(
            gameId
          );

        if (
          !game ||
          game.status !==
            "waiting"
        ) {
          await interaction.reply({
            content:
              "❌ 這場挑戰已經失效或已有人應戰。",

            ephemeral:
              true
          });

          return;
        }

        if (
          interaction.user.id ===
          game.player1Id
        ) {
          await interaction.reply({
            content:
              "😂 不能自己跟自己猜拳啦！",

            ephemeral:
              true
          });

          return;
        }

        game.player2Id =
          interaction.user.id;

        game.status =
          "playing";

        if (
          game.timeout
        ) {
          clearTimeout(
            game.timeout
          );
        }

        await interaction.update({
          content:
            `⚔️ <@${game.player1Id}> VS <@${game.player2Id}>`,

          embeds: [
            buildBattleEmbed(
              game
            )
          ],

          components: []
        });

        await interaction.followUp({
  content:
    "🎮 對戰開始！\n雙方請按下方按鈕秘密出拳。",

  components: [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `rps_open_${gameId}`
          )
          .setLabel(
            "我要出拳"
          )
          .setEmoji(
            "🎮"
          )
          .setStyle(
            ButtonStyle.Primary
          )
      )
});

        return;
      }

      if (
        interaction.customId.startsWith(
          "rps_cancel_"
        )
      ) {

        if (
  interaction.customId.startsWith(
    "rps_open_"
  )
) {
  const gameId =
    interaction.customId.replace(
      "rps_open_",
      ""
    );

  const game =
    games.get(
      gameId
    );

  if (
    !game ||
    game.status !==
      "playing"
  ) {
    await interaction.reply({
      content:
        "❌ 這場猜拳已經結束或失效。",

      ephemeral:
        true
    });

    return;
  }

  const userId =
    interaction.user.id;

  if (
    userId !==
      game.player1Id &&
    userId !==
      game.player2Id
  ) {
    await interaction.reply({
      content:
        "❌ 你不是這場猜拳的玩家。",

      ephemeral:
        true
    });

    return;
  }

  const alreadyChosen =
    userId ===
      game.player1Id
      ? game.player1Choice
      : game.player2Choice;

  if (
    alreadyChosen
  ) {
    await interaction.reply({
      content:
        "✅ 你已經出過拳了！",

      ephemeral:
        true
    });

    return;
  }

  await interaction.reply({
    content:
      "🎮 請秘密選擇你要出的拳：",

    components: [
      buildChoiceButtons(
        gameId
      )
    ],

    ephemeral:
      true
  });

  return;
}
        const gameId =
          interaction.customId.replace(
            "rps_cancel_",
            ""
          );

        const game =
          games.get(
            gameId
          );

        if (
          !game
        ) {
          await interaction.reply({
            content:
              "❌ 這場挑戰已經不存在。",

            ephemeral:
              true
          });

          return;
        }

        if (
          interaction.user.id !==
          game.player1Id
        ) {
          await interaction.reply({
            content:
              "❌ 只有發起挑戰的人可以取消。",

            ephemeral:
              true
          });

          return;
        }

        if (
          game.timeout
        ) {
          clearTimeout(
            game.timeout
          );
        }

        games.delete(
          gameId
        );

        await interaction.update({
          content:
            "❌ 猜拳挑戰已取消",

          embeds: [
            new EmbedBuilder()
              .setColor(
                "#E74C3C"
              )
              .setTitle(
                "❌ 挑戰取消"
              )
              .setDescription(
                `<@${game.player1Id}> 取消了猜拳挑戰。`
              )
          ],

          components: []
        });

        return;
      }

      if (
        interaction.customId.startsWith(
          "rps_choice_"
        )
      ) {
        const parts =
          interaction.customId.split(
            "_"
          );

        const choice =
          parts[
            parts.length - 1
          ];

        const gameId =
          parts
            .slice(
              2,
              parts.length - 1
            )
            .join("_");

        const game =
          games.get(
            gameId
          );

        if (
          !game ||
          game.status !==
            "playing"
        ) {
          await interaction.reply({
            content:
              "❌ 這場猜拳已經結束或失效。",

            ephemeral:
              true
          });

          return;
        }

        const userId =
          interaction.user.id;

        if (
          userId !==
            game.player1Id &&
          userId !==
            game.player2Id
        ) {
          await interaction.reply({
            content:
              "❌ 你不是這場猜拳的玩家。",

            ephemeral:
              true
          });

          return;
        }

        if (
          userId ===
          game.player1Id
        ) {
          if (
            game.player1Choice
          ) {
            await interaction.reply({
              content:
                "❌ 你已經出過拳了，不能修改。",

              ephemeral:
                true
            });

            return;
          }

          game.player1Choice =
            choice;
        }

        if (
          userId ===
          game.player2Id
        ) {
          if (
            game.player2Choice
          ) {
            await interaction.reply({
              content:
                "❌ 你已經出過拳了，不能修改。",

              ephemeral:
                true
            });

            return;
          }

          game.player2Choice =
            choice;
        }

        await interaction.update({
          content:
            `✅ 你出了 ${getChoiceEmoji(choice)} ${getChoiceName(choice)}\n等待對方出拳……`,

          components: []
        });

        const channel =
          await client.channels.fetch(
            game.channelId
          );

        const battleMessage =
          await channel.messages.fetch(
            game.messageId
          );

        if (
          !game.player1Choice ||
          !game.player2Choice
        ) {
          await battleMessage.edit({
            embeds: [
              buildBattleEmbed(
                game
              )
            ]
          });

          return;
        }

        game.status =
          "finished";

        await battleMessage.edit({
          content:
            `🎉 <@${game.player1Id}> VS <@${game.player2Id}> 猜拳結果出爐！`,

          embeds: [
            buildResultEmbed(
              game
            )
          ],

          components: []
        });

        games.delete(
          gameId
        );
      }
    }
  );
}

module.exports = {
  setupRpsGame
};
