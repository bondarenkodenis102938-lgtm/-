import { Telegraf } from "telegraf";
import { getMollyReply } from "./ai.js";
import { config } from "./config.js";
import { addMessage, clearHistory, getHistory } from "./history.js";

const bot = new Telegraf(config.telegramToken);

function splitTelegramMessage(text: string, limit = 4000): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt < limit * 0.5) splitAt = remaining.lastIndexOf(" ", limit);
    if (splitAt < limit * 0.5) splitAt = limit;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

bot.start(async (ctx) => {
  await ctx.reply(
    "Привет! Я Молли 🦋\n\nРада знакомству. Можешь просто написать мне — и мы поболтаем.\n\nКоманда /clear очистит историю нашего разговора.",
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    "Я Молли 🦋 Просто отправь мне сообщение, чтобы начать разговор.\n\n/start — начать\n/clear — очистить историю этого чата\n/model — показать используемую модель\n/help — помощь",
  );
});

bot.command("clear", async (ctx) => {
  if (ctx.chat) clearHistory(ctx.chat.id);
  await ctx.reply("Хорошо, начнём с чистого листа 🦋");
});

bot.command("model", async (ctx) => {
  await ctx.reply(`Сейчас я работаю через модель: ${config.tokenReplyModel}`);
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;

  const chatId = ctx.chat.id;

  try {
    await ctx.sendChatAction("typing");

    const previousHistory = getHistory(chatId);
    const nextHistory = [
      ...previousHistory,
      { role: "user" as const, content: text },
    ];

    const reply = await getMollyReply(nextHistory);

    addMessage(chatId, { role: "user", content: text }, config.historyMaxMessages);
    addMessage(chatId, { role: "assistant", content: reply }, config.historyMaxMessages);

    for (const chunk of splitTelegramMessage(reply)) {
      await ctx.reply(chunk);
    }
  } catch (error) {
    console.error("Message handling error:", error);
    await ctx.reply(
      "Ой, у меня не получилось ответить. Попробуй ещё раз чуть позже 🥺",
    );
  }
});

bot.catch((error) => {
  console.error("Telegram bot error:", error);
});

async function main(): Promise<void> {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Начать разговор" },
    { command: "clear", description: "Очистить историю чата" },
    { command: "model", description: "Показать используемую модель" },
    { command: "help", description: "Помощь" },
  ]);

  await bot.launch();
  console.log("Molly Telegram bot is running.");
}

main().catch((error) => {
  console.error("Failed to start Molly:", error);
  process.exitCode = 1;
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));