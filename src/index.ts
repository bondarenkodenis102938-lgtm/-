import { Context, Telegraf } from "telegraf";
import { getMollyReply } from "./ai.js";
import { config } from "./config.js";
import { getOrCreateUser, initializeDatabase } from "./database.js";
import { addMessage, clearHistory, getHistory } from "./history.js";
import { getRelationshipContext } from "./relationship.js";

const bot = new Telegraf(config.telegramToken);

const MESSAGE_DEBOUNCE_MS = 1_500;
const REPLY_COOLDOWN_MS = 2_500;
const MAX_BATCH_WAIT_MS = 5_000;

interface ChatQueue {
  messages: string[];
  latestContext: Context;
  timer: ReturnType<typeof setTimeout> | null;
  firstMessageAt: number;
  processing: boolean;
  lastReplyAt: number;
}

const chatQueues = new Map<number, ChatQueue>();

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

function scheduleChatFlush(chatId: number, queue: ChatQueue): void {
  if (queue.timer) clearTimeout(queue.timer);

  const elapsed = Date.now() - queue.firstMessageAt;
  const debounceDelay = Math.max(
    0,
    Math.min(MESSAGE_DEBOUNCE_MS, MAX_BATCH_WAIT_MS - elapsed),
  );

  queue.timer = setTimeout(() => {
    queue.timer = null;
    void processChatQueue(chatId, queue);
  }, debounceDelay);
}

async function processChatQueue(chatId: number, queue: ChatQueue): Promise<void> {
  if (queue.processing || queue.messages.length === 0) return;

  const cooldownRemaining =
    queue.lastReplyAt + REPLY_COOLDOWN_MS - Date.now();

  if (cooldownRemaining > 0) {
    queue.timer = setTimeout(() => {
      queue.timer = null;
      void processChatQueue(chatId, queue);
    }, cooldownRemaining);
    return;
  }

  queue.processing = true;
  const batch = queue.messages.splice(0).join("\n");
  const ctx = queue.latestContext;
  queue.firstMessageAt = 0;

  try {
    await ctx.sendChatAction("typing");

    const profile = getOrCreateUser(ctx.from!.id);
    const previousHistory = getHistory(chatId);
    const nextHistory = [
      ...previousHistory,
      { role: "user" as const, content: batch },
    ];

    const reply = await getMollyReply(
      nextHistory,
      getRelationshipContext(profile),
    );

    addMessage(chatId, { role: "user", content: batch }, config.historyMaxMessages);
    addMessage(chatId, { role: "assistant", content: reply }, config.historyMaxMessages);

    for (const chunk of splitTelegramMessage(reply)) {
      await ctx.reply(chunk);
    }
  } catch (error) {
    console.error("Message handling error:", error);
    await ctx.reply(
      "Ой, у меня не получилось ответить. Попробуй ещё раз чуть позже 🥺",
    );
  } finally {
    queue.lastReplyAt = Date.now();
    queue.processing = false;

    if (queue.messages.length > 0) {
      if (queue.firstMessageAt === 0) queue.firstMessageAt = Date.now();
      scheduleChatFlush(chatId, queue);
    }
  }
}

bot.start(async (ctx) => {
  if (ctx.from) getOrCreateUser(ctx.from.id);

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
  // Molly is a one-to-one companion; do not mix multiple users in group-chat history.
  if (ctx.chat.type !== "private") return;

  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;

  const chatId = ctx.chat.id;
  let queue = chatQueues.get(chatId);

  if (!queue) {
    queue = {
      messages: [],
      latestContext: ctx,
      timer: null,
      firstMessageAt: 0,
      processing: false,
      lastReplyAt: 0,
    };
    chatQueues.set(chatId, queue);
  }

  if (queue.messages.length === 0) queue.firstMessageAt = Date.now();
  queue.messages.push(text);
  queue.latestContext = ctx;

  // Combine rapid consecutive messages into one prompt instead of answering each separately.
  scheduleChatFlush(chatId, queue);
});

bot.catch((error) => {
  console.error("Telegram bot error:", error);
});

async function main(): Promise<void> {
  initializeDatabase();

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