"use strict";

const { google } = require("googleapis");
const sharp = require("sharp");
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, PermissionFlagsBits, AttachmentBuilder
} = require("discord.js");

const CHANNEL_ID = "1559597571867943092";
const SHEET_ID = process.env.SHEET_ID;
const SUBMISSIONS_TAB = "變裝比賽作品";
const VOTES_TAB = "變裝比賽選票";
const TEST_VOTES_TAB = "變裝比賽測試選票";
const STATE_TAB = "變裝比賽設定";
const START_MS = Date.parse("2026-10-17T16:00:00Z"); // 10/18 00:00 台灣
const END_MS = Date.parse("2026-10-29T15:59:59.999Z"); // 10/29 23:59 台灣
const VOTE_START_MS = Date.parse("2026-10-30T03:59:00Z"); // 10/30 11:59 台灣
const DEADLINE_MS = Date.parse("2026-10-31T16:00:00Z"); // 11/01 00:00 台灣，10/31 23:59 全分鐘可投票
const PREFIX = "-變裝";
const HEADERS = {
  [SUBMISSIONS_TAB]: ["作品訊息ID", "作者Discord ID", "作者名稱", "作品圖片URL", "作品訊息連結", "投稿時間", "審核狀態"],
  [VOTES_TAB]: ["投票者Discord ID", "作品訊息ID", "最後投票時間", "票次"],
  [TEST_VOTES_TAB]: ["投票者Discord ID", "作品訊息ID", "最後投票時間", "票次"],
  [STATE_TAB]: ["設定", "值"]
};

let sheets;
let initPromise;
let queue = Promise.resolve();
let tickBusy = false;
// 作品資料快取：減少左右切換與作品總覽時反覆查詢 Google / Discord。
let candidatesCache = { expires: 0, items: [] };
let galleryCache = new Map();
function clearCostumeCache() { candidatesCache.expires = 0; galleryCache.clear(); }
async function approvedCandidates(client) {
  if (Date.now() < candidatesCache.expires) return candidatesCache.items;
  const items = await withGuildNames(client, (await read(SUBMISSIONS_TAB)).map(candidateRow).filter(c => c.status === "已核准"));
  candidatesCache = { expires: Date.now() + 60000, items };
  return items;
}
function svgEscape(s) { return String(s).replace(/[&<>"']/g, x => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[x])); }
async function downloadThumbnail(url, width, height) {
  if (!/^https:\/\//i.test(url || "")) throw new Error("無效圖片網址");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error("不是圖片");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 12000000) throw new Error("圖片過大");
    return await sharp(bytes, { animated: false }).rotate().resize(width, height, { fit: "contain", background: "#242631" }).png().toBuffer();
  } finally { clearTimeout(timer); }
}
async function makeGallery(candidates, page = 0) {
  const perPage = 20, cols = 4, cellW = 220, cellH = 244, photoH = 190;
  const slice = candidates.slice(page * perPage, (page + 1) * perPage);
  const cacheKey = slice.map(c => c.id + ":" + c.image).join("|");
  const old = galleryCache.get(cacheKey);
  if (old && Date.now() < old.expires) return old.buffer;
  const rows = Math.ceil(slice.length / cols);
  const width = cols * cellW, height = rows * cellH;
  const composites = [];
  await Promise.all(slice.map(async (c, i) => {
    const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH;
    try { composites.push({ input: await downloadThumbnail(c.image, cellW - 12, photoH - 8), left: x + 6, top: y + 6 }); }
    catch (err) { console.warn(`[作品縮圖] ${c.id}: ${err.message}`); }
  }));
  const labels = slice.map((c, i) => {
    const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH;
    const num = String(page * perPage + i + 1).padStart(2, "0");
    const name = svgEscape([...String(c.author)].slice(0, 11).join(""));
    return `<rect x="${x+5}" y="${y+photoH+2}" width="${cellW-10}" height="42" rx="6" fill="#343747"/><text x="${x+12}" y="${y+photoH+29}" font-size="17" fill="white" font-family="sans-serif">${num} ${name}</text>`;
  }).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${labels}</svg>`);
  const buffer = await sharp({ create: { width, height, channels: 4, background: "#1b1d28" } })
    .composite([...composites, { input: svg, left: 0, top: 0 }]).png().toBuffer();
  galleryCache.set(cacheKey, { buffer, expires: Date.now() + 300000 });
  if (galleryCache.size > 15) galleryCache.clear();
  return buffer;
}
async function galleryPanel(candidates, page, testing, slot) {
  const totalPages = Math.max(1, Math.ceil(candidates.length / 20));
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const buffer = await makeGallery(candidates, p);
  const embed = new EmbedBuilder().setColor(testing ? 0x3498DB : 0x9B59B6)
    .setTitle(`${testing ? "🧪 測試｜" : "🎃 "}第 ${slot} 票｜參賽作品總覽`)
    .setDescription(`一次查看作品縮圖（第 ${p + 1}/${totalPages} 頁）。請用下方選單選擇編號，查看大圖後再確認投票。\n❗每人兩票、不得重複或投給自己。`)
    .setImage("attachment://costume_overview.png");
  const mode = testing ? "test" : "real";
  const slice = candidates.slice(p * 20, (p + 1) * 20);
  const menu = new StringSelectMenuBuilder().setCustomId(`costume:select:${mode}:${slot}`)
    .setPlaceholder("選擇編號／參賽者，查看大圖")
    .addOptions(slice.map((c,i) => ({ label: `${String(p*20+i+1).padStart(2,"0")}｜${c.author}`.slice(0,100), value:c.id })));
  const components = [new ActionRowBuilder().addComponents(menu)];
  if (totalPages > 1) components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`costume:gallery:${mode}:${slot}:${p-1}`).setLabel("上一頁").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
    new ButtonBuilder().setCustomId(`costume:gallery:${mode}:${slot}:${p+1}`).setLabel("下一頁").setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1)));
  return { content: "", embeds: [embed], files: [new AttachmentBuilder(buffer, { name: "costume_overview.png" })], components };
}


function locked(task) {
  const result = queue.then(task);
  queue = result.catch(err => console.error("[變裝投票]", err));
  return result;
}
function sheetRange(tab, range) { return `'${tab}'!${range}`; }
function nowTaipei() { return new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }); }
function isAdmin(member) { return Boolean(member?.permissions?.has(PermissionFlagsBits.ManageGuild)); }
function isOpen(state) { return state.open === "yes" && Date.now() >= VOTE_START_MS && Date.now() < DEADLINE_MS && state.published !== "yes"; }
function imageAttachment(att) {
  return att.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)(?:\?|$)/i.test(att.url || "");
}

async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!SHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error("缺少 SHEET_ID / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY");
    }
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: "sheets.properties.title" });
    const existing = new Set((meta.data.sheets || []).map(x => x.properties.title));
    const missing = Object.keys(HEADERS).filter(name => !existing.has(name));
    if (missing.length) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: {
        requests: missing.map(title => ({ addSheet: { properties: { title } } }))
      }});
    }
    for (const [name, headers] of Object.entries(HEADERS)) {
      const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: sheetRange(name, "A1:G1") });
      if (!(result.data.values || []).length) {
        await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID,
          range: sheetRange(name, `A1:${String.fromCharCode(64 + headers.length)}1`),
          valueInputOption: "RAW", requestBody: { values: [headers] } });
      }
    }
     // 舊版選票分頁可能只有 A～C 欄，補上 D 欄標題而不動既有選票。
     for (const tab of [VOTES_TAB, TEST_VOTES_TAB]) {
       await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID,
         range: sheetRange(tab, "D1"), valueInputOption: "RAW",
         requestBody: { values: [["票次"]] } });
     }
   })().catch(err => { initPromise = undefined; throw err; });
  return initPromise;
}
async function read(tab) {
  await initialize();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: sheetRange(tab, "A2:G") });
  return response.data.values || [];
}
async function append(tab, values) {
  await initialize();
  await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: sheetRange(tab, "A:G"),
    valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [values] } });
}
async function updateRow(tab, index, values) {
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID,
    range: sheetRange(tab, `A${index + 2}:${String.fromCharCode(64 + values.length)}${index + 2}`),
    valueInputOption: "RAW", requestBody: { values: [values] } });
}
async function stateGet() {
  const rows = await read(STATE_TAB);
  return Object.fromEntries(rows.filter(r => r[0]).map(r => [r[0], r[1] || ""]));
}
async function stateSet(key, value) {
  const rows = await read(STATE_TAB);
  const index = rows.findIndex(r => r[0] === key);
  if (index < 0) await append(STATE_TAB, [key, value]);
  else await updateRow(STATE_TAB, index, [key, value]);
}
async function getChannel(client) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel?.isTextBased() || !channel.messages?.fetch) throw new Error("投稿頻道不可讀取，請確認 Bot 權限與頻道 ID");
  return channel;
}
async function scan(client) {
  const channel = await getChannel(client);
  const old = await read(SUBMISSIONS_TAB);
  const seen = new Set(old.map(r => r[0]));
  let before;
  let count = 0;
  let examined = 0;
  for (let page = 0; page < 200; page++) {
    const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!messages.size) break;
    examined += messages.size;
    for (const msg of messages.values()) {
      if (msg.createdTimestamp < START_MS || msg.createdTimestamp > END_MS || msg.author.bot) continue;
      const photo = msg.attachments.find(imageAttachment);
      if (!photo || seen.has(msg.id)) continue;
      await append(SUBMISSIONS_TAB, [msg.id, msg.author.id, (msg.member?.displayName || msg.author.username), photo.url,
        msg.url, new Date(msg.createdTimestamp).toISOString(), "待審核"]);
      seen.add(msg.id);
      count++;
    }
    const last = messages.last();
    if (!last || last.createdTimestamp < START_MS) break;
    before = last.id;
  }
  clearCostumeCache();
  return { count, examined };
}
// 舊版每人一列的選票視為第一票；新版 D 欄記錄票次（1 / 2）。
function voteSlot(row) { return row[3] === "2" ? 2 : 1; }
function userBallots(rows, userId) {
  const result = new Map();
  rows.forEach((row, index) => {
    if (row[0] === userId) result.set(voteSlot(row), { row, index });
  });
  return result;
}
function voteCount(rows, candidates) {
  const allowed = new Map(candidates.map(c => [c.id, c]));
  const byUser = new Map();
  rows.forEach(row => {
    if (!row[0] || !row[1]) return;
    if (!byUser.has(row[0])) byUser.set(row[0], new Map());
    byUser.get(row[0]).set(voteSlot(row), row[1]);
  });
  const counts = new Map(candidates.map(c => [c.id, 0]));
  let voters = 0, validVotes = 0;
  for (const [userId, slots] of byUser) {
    const used = new Set();
    let any = false;
    for (const slot of [1, 2]) {
      const id = slots.get(slot), candidate = allowed.get(id);
      if (!candidate || candidate.authorId === userId || used.has(id)) continue;
      used.add(id);
      counts.set(id, counts.get(id) + 1);
      validVotes++;
      any = true;
    }
    if (any) voters++;
  }
  return { counts, voters, validVotes };
}
function slotPicker(testing) {
  const mode = testing ? "test" : "real";
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`costume:slot:${mode}:1`).setLabel("第一票／改票").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`costume:slot:${mode}:2`).setLabel("第二票／改票").setStyle(ButtonStyle.Primary)
  );
}
function ballotSummary(rows, userId, candidates) {
  const slots = userBallots(rows, userId);
  const display = slot => {
    const id = slots.get(slot)?.row[1];
    const c = candidates.find(x => x.id === id);
    return c ? `**${c.author}**｜${c.url}` : "尚未投票";
  };
  return `🗳️ 你的選票（最多兩票，不可投相同作品）\n第一票：${display(1)}\n第二票：${display(2)}`;
}

function candidateRow(r) {
  return { id: r[0], authorId: r[1], author: r[2], image: r[3], url: r[4], date: r[5], status: r[6] };
}
async function withGuildNames(client, candidates) {
  const channel = await getChannel(client);
  const guild = channel.guild;
  const names = new Map();
  await Promise.all([...new Set(candidates.map(c => c.authorId))].map(async id => {
    try {
      const member = await guild.members.fetch(id);
      if (member) names.set(id, member.displayName);
    } catch (err) {
      console.warn(`[變裝暱稱] ${id}: ${err.message}`);
    }
  }));
  return candidates.map(c => ({ ...c, author: names.get(c.authorId) || c.author }));
}
function previewPanel(candidate, testing, index, total, slot) {
  const embed = new EmbedBuilder().setColor(testing ? 0x3498DB : 0x9B59B6)
    .setTitle(testing ? "🧪 測試｜瀏覽參賽作品" : "🎃 瀏覽參賽作品")
    .setDescription(`**第 ${index + 1} / ${total} 件**｜**第 ${slot} 票**\n**參賽者：${candidate.author}**\n[查看原始投稿](${candidate.url})\n\n按左右箭頭切換作品；只有按「確認投票」才會記錄選票。`);
  if (candidate.image?.startsWith("https://")) embed.setImage(candidate.image);
  const tag = testing ? "testconfirm" : "confirm";
  const mode = testing ? "test" : "real";
  return { embeds: [embed], components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`costume:browse:${mode}:${slot}:${Math.max(0, index - 1)}`).setLabel("上一件").setEmoji("⬅️").setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
      new ButtonBuilder().setCustomId(`costume:browse:${mode}:${slot}:${Math.min(total - 1, index + 1)}`).setLabel("下一件").setEmoji("➡️").setStyle(ButtonStyle.Secondary).setDisabled(index >= total - 1)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`costume:${tag}:${slot}:${candidate.id}`).setLabel("確認投票").setEmoji("✅").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`costume:list:${mode}:${slot}`).setLabel("作品清單").setEmoji("📋").setStyle(ButtonStyle.Secondary)
    )
  ] };
}
function reviewEmbed(c, index, total) {
  const embed = new EmbedBuilder().setColor(0xF59E0B)
    .setTitle(`🎃 參賽作品審核 ${index + 1}/${total}`)
    .setDescription(`作者：<@${c.authorId}>\n狀態：**${c.status}**\n[查看原始投稿](${c.url})\n作品 ID：\`${c.id}\``);
  if (c.image?.startsWith("https://")) embed.setImage(c.image);
  return embed;
}
function reviewButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("costume:approve").setLabel("核准").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("costume:reject").setLabel("排除").setEmoji("❌").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("costume:next").setLabel("下一件").setStyle(ButtonStyle.Secondary)
  )];
}
const reviewSessions = new Map();
function votePanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle("🎃 EtheReal 萬聖節變裝大賽｜正式投票")
      .setDescription("每位會員 **兩票**，必須投給**不同作品**，**禁止投給自己的作品**。\n截止前可以改票，以最後一次投票為準。\n\n🕒 **2026/10/30 11:59 開始投票**\n⏰ **2026/10/31 23:59 截止（台灣時間）**\n按下方按鈕選擇作品；投票期間不公開即時票數。")],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("costume:vote:0").setLabel("🗳️ 我要投票／改票").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("costume:mine").setLabel("查看我的選票").setStyle(ButtonStyle.Secondary)
    )]
  };
}
function testPanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x3498DB)
      .setTitle("🧪 EtheReal 變裝比賽｜測試投票（非正式）")
      .setDescription("這是測試模式，選票**不會計入正式比賽**。\n每人最多兩票、兩票不可重複、禁止投自己、可改票。管理員可隨時結束測試。")],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("costume:testvote:0").setLabel("🧪 測試投票／改票").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("costume:testmine").setLabel("查看測試選票").setStyle(ButtonStyle.Secondary)
    )]
  };
}
function selectPage(candidates, page, testing = false, slot = 1) {
  const totalPages = Math.max(1, Math.ceil(candidates.length / 25));
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const slice = candidates.slice(p * 25, (p + 1) * 25);
  const menu = new StringSelectMenuBuilder().setCustomId(`costume:select:${testing ? "test" : "real"}:${slot}`)
    .setPlaceholder(`選擇參賽作品（第 ${p + 1}/${totalPages} 頁）`)
    .addOptions(slice.map((c, i) => ({ label: `${p * 25 + i + 1}. ${c.author}`.slice(0, 100),
      description: `作品 ${c.id}`.slice(0, 100), value: c.id })));
  const components = [new ActionRowBuilder().addComponents(menu)];
  if (totalPages > 1) components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`costume:page:${testing ? "test" : "real"}:${slot}:${p - 1}`).setLabel("上一頁").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
    new ButtonBuilder().setCustomId(`costume:page:${testing ? "test" : "real"}:${slot}:${p + 1}`).setLabel("下一頁").setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1)
  ));
  return components;
}
async function publish(client) {
  const state = await stateGet();
  if (state.published === "yes" || Date.now() < DEADLINE_MS || (state.open !== "yes" && state.publishing !== "yes")) return false;
  // 先標記鎖定，防止重啟重複發文；若發送失敗會留下待處理狀態。
  await stateSet("open", "no");
  if (state.publishing === "yes") return false;
  await stateSet("publishing", "yes");
  const candidates = await approvedCandidates(client);
  const validIds = new Set(candidates.map(c => c.id));
   const votes = await read(VOTES_TAB);
   const { counts, voters, validVotes } = voteCount(votes, candidates);
  const ordered = candidates.sort((a, b) => counts.get(b.id) - counts.get(a.id) || a.id.localeCompare(b.id));
  let rank = 0, lastCount = null;
  const lines = ordered.map((c, i) => {
    const n = counts.get(c.id);
    if (n !== lastCount) rank = i + 1;
    lastCount = n;
    return `${rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : "🎭"} **第 ${rank} 名**｜<@${c.authorId}>：**${n} 票**｜[作品](${c.url})`;
  });
  const channel = await getChannel(client);
  const text = `🏆 **EtheReal 萬聖節變裝大賽｜投票結果**\n\n${lines.join("\n") || "本次沒有核准作品。"}\n\n有效投票人數：${voters} 人｜有效票數：${validVotes} 票\n截止時間：2026/10/31 23:59（台灣時間）`;
  // 分段避免 Discord 2000 字限制
  for (let i = 0; i < text.length; i += 1900) await channel.send({ content: text.slice(i, i + 1900), allowedMentions: { parse: [] } });
  await stateSet("published", "yes");
  return true;
}

// 僅預覽測試票的排名：不修改正式選票、不設定 published，也不關閉測試模式。
async function testResultsPreview(client) {
  const candidates = await withGuildNames(client,
    (await read(SUBMISSIONS_TAB)).map(candidateRow).filter(c => c.status === "已核准"));
  const votes = await read(TEST_VOTES_TAB);
  const { counts, voters, validVotes } = voteCount(votes, candidates);
  const ordered = [...candidates].sort((a, b) => counts.get(b.id) - counts.get(a.id) || a.id.localeCompare(b.id));
  let rank = 0, previousCount = null;
  const lines = ordered.map((c, index) => {
    const count = counts.get(c.id);
    if (count !== previousCount) rank = index + 1;
    previousCount = count;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🎭";
    return `${medal} **第 ${rank} 名**｜<@${c.authorId}>：**${count} 票**｜[作品](${c.url})`;
  });
  const header = `🧪 **EtheReal 萬聖節變裝大賽｜模擬公布結果**\n⚠️ 這是測試選票，不是正式結果。\n\n`;
  const footer = `\n\n有效投票人數：**${voters} 人**｜有效票數：**${validVotes} 票**\n正式投票截止：2026/10/31 23:59（台灣時間）`;
  const chunks = [];
  let current = header;
  for (const line of lines.length ? lines : ["目前沒有已核准作品。"]) {
    if (current.length + line.length + 1 > 1800) {
      chunks.push(current);
      current = "";
    }
    current += `${line}\n`;
  }
  if (current.length + footer.length > 1900) {
    chunks.push(current);
    current = "";
  }
  chunks.push(current + footer);
  return chunks;
}

function setupCostumeVoting(client) {
  client.on("messageCreate", async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    if (!message.guild || !isAdmin(message.member)) return;
    const command = message.content.trim().slice(PREFIX.length).trim();
    if (!["掃描", "審核", "審核全部", "重設審核", "開放", "狀態", "公布", "測試", "測試結束", "測試結果"].includes(command)) return;
    try {
      if (command === "掃描") {
        await message.reply("🔎 正在掃描 10/18～10/29 的圖片投稿，請稍候……");
        const result = await locked(() => scan(client));
        return message.channel.send(`✅ 掃描完成，新增 **${result.count}** 件作品（檢查 ${result.examined} 則訊息）。請輸入 \`-變裝審核\`。`);
      }
      if (command === "重設審核") {
        const result = await locked(async () => {
          const state = await stateGet();
          if (state.open === "yes" || state.published === "yes") return "❌ 投票已開放或已公布，不能重設審核。";
          const rows = await read(SUBMISSIONS_TAB);
          let changed = 0;
          for (let i = 0; i < rows.length; i++) {
            if (rows[i][6] !== "已核准") continue;
            rows[i][6] = "待審核";
            await updateRow(SUBMISSIONS_TAB, i, rows[i]);
            changed++;
          }
          return `✅ 已將 **${changed}** 件已核准作品改為待審核。請輸入 \`-變裝審核\` 逐件確認。`;
        });
        clearCostumeCache();
        reviewSessions.clear();
        return message.reply(result);
      }
      if (command === "審核" || command === "審核全部") {
        const rows = await locked(() => read(SUBMISSIONS_TAB));
        const items = rows.map(candidateRow).filter(c => command === "審核全部" || c.status === "待審核");
        if (!items.length) return message.reply(command === "審核" ? "✅ 目前沒有待審核作品。如要重新查看所有作品，請輸入 `-變裝審核全部`。" : "目前沒有作品，請先執行 `-變裝掃描`。");
        reviewSessions.set(message.author.id, { items, index: 0 });
        return message.reply({ embeds: [reviewEmbed(items[0], 0, items.length)], components: reviewButtons() });
      }
      if (command === "狀態") {
        const [rows, state, votes] = await locked(async () => Promise.all([read(SUBMISSIONS_TAB), stateGet(), read(VOTES_TAB)]));
        return message.reply(`🎃 作品 ${rows.length} 件｜核准 ${rows.filter(r => r[6] === "已核准").length} 件｜待審 ${rows.filter(r => r[6] === "待審核").length} 件\n投票：${state.open === "yes" ? "已開放" : "未開放／已截止"}｜已投票 ${new Set(votes.filter(r => r[0]).map(r => r[0])).size} 人／${voteCount(votes, rows.map(candidateRow).filter(c => c.status === "已核准")).validVotes} 票｜已公布：${state.published === "yes" ? "是" : "否"}\n🧪 測試模式：${state.testOpen === "yes" ? "進行中" : "未開啟"}`);
      }
      if (command === "測試") {
        const result = await locked(async () => {
          const state = await stateGet();
          if (state.open === "yes" || state.published === "yes" || Date.now() >= VOTE_START_MS) {
            return "❌ 正式投票已開始或已結束，不能再開啟測試模式。";
          }
          if (state.testOpen === "yes") return "⚠️ 測試模式已開啟，請先使用 `-變裝測試結束`。";
          const candidates = (await read(SUBMISSIONS_TAB)).map(candidateRow).filter(c => c.status === "已核准");
          if (!candidates.length) return "❌ 尚無已核准的參賽作品。";
          // 清除前次測試資料，避免新一輪測試沿用舊票。
          await initialize();
          await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: sheetRange(TEST_VOTES_TAB, "A2:D") });
          const panel = await message.channel.send(testPanel());
          await stateSet("testPanelId", panel.id);
          await stateSet("testChannelId", message.channel.id);
          await stateSet("testOpen", "yes");
          return `🧪 測試投票已建立（${candidates.length} 件核准作品）。測試票不計入正式結果。`;
        });
        return message.reply(result);
      }
      if (command === "測試結果") {
        const chunks = await locked(() => testResultsPreview(client));
        // 發在執行指令的測試頻道，避免提前公布到正式比賽頻道。
        for (const content of chunks) {
          await message.channel.send({ content, allowedMentions: { parse: [] } });
        }
        return;
      }
      if (command === "測試結束") {
        const result = await locked(async () => {
          const state = await stateGet();
          await stateSet("testOpen", "no");
          await initialize();
          await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: sheetRange(TEST_VOTES_TAB, "A2:D") });
          if (state.testPanelId && state.testChannelId) {
            try {
              const ch = await client.channels.fetch(state.testChannelId);
              const panel = await ch.messages.fetch(state.testPanelId);
              await panel.edit({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle("🧪 測試投票已結束")
                .setDescription("測試選票已清除，不影響正式投票。")], components: [] });
            } catch (err) { console.warn("[變裝測試] 無法移除舊測試面板：", err.message); }
          }
          return "✅ 測試已結束，測試選票已清除，正式選票完全不受影響。";
        });
        return message.reply(result);
      }
      if (command === "開放") {
        const result = await locked(async () => {
          const state = await stateGet();
          if (Date.now() < VOTE_START_MS) return "⏳ 10/30 11:59（台灣時間）才可以正式開放投票。";
          if (Date.now() >= DEADLINE_MS) return "❌ 已超過投票截止時間。";
          if (state.open === "yes") return "⚠️ 投票已開放，請勿重複發佈。";
          if (state.published === "yes") return "❌ 結果已公布。";
          const rows = await read(SUBMISSIONS_TAB);
          if (rows.some(r => r[6] === "待審核")) return "❌ 還有待審核作品，請先輸入 `-變裝審核` 完成審核。";
          if (!rows.some(r => r[6] === "已核准")) return "❌ 尚未核准任何作品。";
          const channel = await getChannel(client);
          await stateSet("testOpen", "no");
          const panel = await channel.send(votePanel());
          await stateSet("panelId", panel.id);
          await stateSet("open", "yes");
          return `✅ 已在 <#${CHANNEL_ID}> 開放投票！`;
        });
        return message.reply(result);
      }
      if (command === "公布") {
        if (Date.now() < DEADLINE_MS) return message.reply("⏳ 尚未截止，不能提前公布結果。");
        const done = await locked(() => publish(client));
        return message.reply(done ? "🏆 已公布結果。" : "⚠️ 已公布或正在公布；若未看到公告請檢查主機紀錄。");
      }
    } catch (err) { console.error("[變裝指令]", err); return message.reply("❌ 操作失敗，請查看主機 Logs（確認 Google Sheets 與 Discord 權限）。").catch(() => {}); }
  });

  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("costume:")) return;
    try {
      if (["costume:approve", "costume:reject", "costume:next"].includes(interaction.customId)) {
        if (!isAdmin(interaction.member)) return interaction.reply({ content: "❌ 只有管理員可以審核。", ephemeral: true });
        const session = reviewSessions.get(interaction.user.id);
        if (!session) return interaction.reply({ content: "審核已失效，請重新輸入 `-變裝審核`。", ephemeral: true });
        await interaction.deferUpdate();
        if (interaction.customId !== "costume:next") {
          const changed = await locked(async () => {
            const state = await stateGet();
            if (state.open === "yes" || state.published === "yes") return false;
            const rows = await read(SUBMISSIONS_TAB);
            const current = session.items[session.index];
            const index = rows.findIndex(r => r[0] === current.id);
            if (index >= 0) {
              rows[index][6] = interaction.customId === "costume:approve" ? "已核准" : "已排除";
              await updateRow(SUBMISSIONS_TAB, index, rows[index]);
              current.status = rows[index][6];
              clearCostumeCache();
            }
            return true;
          });
          if (!changed) return interaction.editReply({ content: "⚠️ 投票已開放或已公布，不能再變更參賽名單。", embeds: [], components: [] });
        }
        session.index++;
        if (session.index >= session.items.length) {
          reviewSessions.delete(interaction.user.id);
          return interaction.editReply({ content: "✅ 已瀏覽完所有作品。可輸入 `-變裝審核全部` 再次檢查。", embeds: [], components: [] });
        }
        return interaction.editReply({ embeds: [reviewEmbed(session.items[session.index], session.index, session.items.length)], components: reviewButtons() });
      }
      if (interaction.customId === "costume:mine" || interaction.customId === "costume:testmine") {
         const testing = interaction.customId === "costume:testmine";
         await interaction.deferReply({ ephemeral: true });
         const result = await locked(async () => {
           if (testing && (await stateGet()).testOpen !== "yes") return "🧪 測試模式已結束。";
           const rows = await read(testing ? TEST_VOTES_TAB : VOTES_TAB);
           const candidates = await withGuildNames(client, (await read(SUBMISSIONS_TAB)).map(candidateRow));
           return ballotSummary(rows, interaction.user.id, candidates);
         });
         return interaction.editReply(result);
       }
       if (interaction.customId.startsWith("costume:vote:") || interaction.customId.startsWith("costume:testvote:")) {
         const testing = interaction.customId.startsWith("costume:testvote:");
         await interaction.deferReply({ ephemeral: true });
         const state = await locked(() => stateGet());
         if (testing ? state.testOpen !== "yes" || Date.now() >= VOTE_START_MS : !isOpen(state))
           return interaction.editReply("❌ 投票未開放或已截止。");
         return interaction.editReply({ content: "請先選擇要投哪一票（可修改）。", embeds: [], components: [slotPicker(testing)] });
       }
       if (interaction.customId.startsWith("costume:gallery:")) {
         const parts = interaction.customId.split(":");
         const testing = parts[2] === "test", slot = Number(parts[3]), page = Number(parts[4]);
         await interaction.deferUpdate();
         const state = await locked(() => stateGet());
         if (testing ? state.testOpen !== "yes" || Date.now() >= VOTE_START_MS : !isOpen(state))
           return interaction.editReply({ content: "❌ 投票已結束。", embeds: [], components: [], attachments: [] });
         const candidates = await locked(() => approvedCandidates(client));
         if (![1,2].includes(slot) || !Number.isSafeInteger(page) || page < 0 || page >= Math.ceil(candidates.length/20))
           return interaction.editReply({ content: "作品頁碼無效。", embeds: [], components: [], attachments: [] });
         return interaction.editReply({ ...(await galleryPanel(candidates, page, testing, slot)), attachments: [] });
       }
       if (interaction.customId.startsWith("costume:slot:") || interaction.customId.startsWith("costume:page:")) {
         const parts = interaction.customId.split(":");
         const testing = parts[2] === "test", slot = Number(parts[3]);
         const page = parts[1] === "page" ? Number(parts[4]) : 0;
         await interaction.deferReply({ ephemeral: true });
         const data = await locked(async () => ({ state: await stateGet(), candidates: await approvedCandidates(client) }));
         if (testing ? data.state.testOpen !== "yes" || Date.now() >= VOTE_START_MS : !isOpen(data.state))
           return interaction.editReply("❌ 投票未開放或已截止。");
         if (![1, 2].includes(slot) || !Number.isSafeInteger(page) || page < 0) return interaction.editReply("票次或頁碼無效。");
         if (!data.candidates.length) return interaction.editReply("沒有可投票作品。");
         return interaction.editReply(await galleryPanel(data.candidates, page, testing, slot));
       }
       if (interaction.customId.startsWith("costume:browse:") || interaction.customId.startsWith("costume:list:")) {
         const parts = interaction.customId.split(":");
         const testing = parts[2] === "test", slot = Number(parts[3]);
         await interaction.deferUpdate();
         const result = await locked(async () => {
           const state = await stateGet();
           if (testing ? state.testOpen !== "yes" || Date.now() >= VOTE_START_MS : !isOpen(state)) return { error: "❌ 投票未開放或已結束。" };
           if (![1, 2].includes(slot)) return { error: "票次無效。" };
           const candidates = await approvedCandidates(client);
           if (!candidates.length) return { error: "沒有已核准作品。" };
           if (parts[1] === "list") return { list: true, candidates };
           const index = Number(parts[4]);
           if (!Number.isSafeInteger(index) || index < 0 || index >= candidates.length) return { error: "作品編號無效。" };
           return { candidates, index };
         });
         if (result.error) return interaction.editReply({ content: result.error, embeds: [], components: [] });
         if (result.list) return interaction.editReply({ ...(await galleryPanel(result.candidates, 0, testing, slot)), attachments: [] });
         return interaction.editReply({ content: "", ...previewPanel(result.candidates[result.index], testing, result.index, result.candidates.length, slot), attachments: [] });
       }
       if (interaction.customId.startsWith("costume:select:")) {
         const parts = interaction.customId.split(":");
         const testing = parts[2] === "test", slot = Number(parts[3]);
         await interaction.deferReply({ ephemeral: true });
         const result = await locked(async () => {
           const state = await stateGet();
           if (testing ? state.testOpen !== "yes" || Date.now() >= VOTE_START_MS : !isOpen(state)) return { error: "❌ 投票未開放或已截止。" };
           if (![1, 2].includes(slot)) return { error: "票次無效。" };
           const candidates = await approvedCandidates(client);
           const index = candidates.findIndex(c => c.id === interaction.values[0]);
           if (index < 0) return { error: "❌ 作品不存在或未核准。" };
           return { candidates, index };
         });
         return interaction.editReply(result.error ? { content: result.error, embeds: [], components: [], attachments: [] } : { content: "", ...previewPanel(result.candidates[result.index], testing, result.index, result.candidates.length, slot), attachments: [] });
       }
       if (interaction.customId.startsWith("costume:confirm:") || interaction.customId.startsWith("costume:testconfirm:")) {
         const parts = interaction.customId.split(":");
         const testing = parts[1] === "testconfirm", slot = Number(parts[2]), candidateId = parts[3];
         // 更新同一個私人預覽畫面，不會再跳出第二則訊息。
         await interaction.deferUpdate();
         const result = await locked(async () => {
           const state = await stateGet();
           if (testing ? state.testOpen !== "yes" || Date.now() >= VOTE_START_MS : !isOpen(state)) return { error: "❌ 投票未開放或已截止。" };
           if (![1, 2].includes(slot)) return { error: "❌ 票次無效。" };
           const candidates = await approvedCandidates(client);
           const candidate = candidates.find(c => c.id === candidateId);
           if (!candidate) return { error: "❌ 作品已移除或未核准。" };
           if (candidate.authorId === interaction.user.id) return { error: "❌ 不能投票給自己的作品。請左右切換選擇其他作品。" };
           const tab = testing ? TEST_VOTES_TAB : VOTES_TAB;
           const rows = await read(tab);
           const ballots = userBallots(rows, interaction.user.id);
           const other = ballots.get(slot === 1 ? 2 : 1);
           if (other?.row[1] === candidateId) return { error: "❌ 兩票必須投給不同作品，請左右切換選擇其他作品。" };
           const current = ballots.get(slot);
           const values = [interaction.user.id, candidate.id, nowTaipei(), String(slot)];
           if (!current) await append(tab, values);
           else await updateRow(tab, current.index, values);
           const success = `✅ ${testing ? "【測試】" : ""}第 ${slot} 票${current ? "修改" : "投票"}成功！投給 **${candidate.author}**。`;
           if (slot === 1) {
             // 第一票完成後，直接顯示第二票的第一件合格作品。
             const nextIndex = candidates.findIndex(c => c.id !== candidate.id && c.authorId !== interaction.user.id);
             if (nextIndex >= 0) return { next: true, success, candidates, index: nextIndex };
             return { done: `${success}\n⚠️ 目前沒有其他可投的作品，第二票暫時無法投出。` };
           }
           const updated = userBallots(await read(tab), interaction.user.id);
           const first = candidates.find(c => c.id === updated.get(1)?.row[1]);
           const second = candidates.find(c => c.id === updated.get(2)?.row[1]);
           return { done: `🎉 ${testing ? "【測試】" : ""}投票完成！\n\n🗳️ 第一票：${first ? `**${first.author}**` : "尚未投票"}\n🗳️ 第二票：${second ? `**${second.author}**` : "尚未投票"}\n\n截止前可以從投票公告重新進入修改選票。` };
         });
         if (result.error) return interaction.editReply({ content: result.error, components: [] });
         if (result.next) return interaction.editReply({ ...(await galleryPanel(result.candidates, 0, testing, 2)), content: `${result.success}\n\n➡️ **現在自動進入第二票，請從縮圖總覽挑選！**`, attachments: [] });
         return interaction.editReply({ content: result.done, embeds: [], components: [] });
       }
    } catch (err) {
      console.error("[變裝互動]", err);
      const payload = { content: "❌ 操作失敗，請稍後重試或通知管理員。", components: [] };
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
      else await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
    }
  });

  client.once("ready", () => {
    console.log("🎃 變裝比賽系統已載入");
    const check = async () => {
      if (tickBusy || Date.now() < DEADLINE_MS) return;
      tickBusy = true;
      try { await locked(() => publish(client)); }
      catch (err) { console.error("[變裝自動公布]", err); }
      finally { tickBusy = false; }
    };
    check();
    const timer = setInterval(check, 30000);
    timer.unref?.();
  });
}

module.exports = { setupCostumeVoting };
