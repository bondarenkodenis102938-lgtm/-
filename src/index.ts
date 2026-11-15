import { Context, Telegraf } from "telegraf";
import { getMollyReply } from "./ai.js";
import { config } from "./config.js";
import { getOrCreateUser, initializeDatabase } from "./database.js";
import { addMessage, clearHistory, getHistory } from "./history.js";
import { getRelationshipContext } from "./relationship.js";

const bot = new Telegraf(config.telegramToken);

const MESSAGE_DEBOUNCE_MS = 5_000;

interface ChatQueue {
  messages: string[];
  latestContext: Context;
  timer: ReturnType<typeof setTimeout> | null;
  lastMessageAt: number;
  processing: boolean;
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

  const elapsed = Date.now() - queue.lastMessageAt;
  const remainingDelay = Math.max(0, MESSAGE_DEBOUNCE_MS - elapsed);

  queue.timer = setTimeout(() => {
    queue.timer = null;
    void processChatQueue(chatId, queue);
  }, remainingDelay);
}

function formatMessageBatch(messages: string[]): string {
  if (messages.length === 1) return messages[0];

  const numberedMessages = messages
    .map((message, index) => `${index + 1}. ${message}`)
    .join("\n");

  return `Пользователь отправил несколько сообщений подряд, прежде чем ты успела ответить. Прочитай их все по порядку и ответь на них как на одну цельную реплику, учитывая каждое сообщение:\n${numberedMessages}`;
}

async function processChatQueue(chatId: number, queue: ChatQueue): Promise<void> {
  if (queue.processing || queue.messages.length === 0) return;

  // If the timer fired while a previous AI response was still being generated,
  // wait only for the remainder of the 5-second quiet period.
  const remainingDelay = MESSAGE_DEBOUNCE_MS - (Date.now() - queue.lastMessageAt);
  if (remainingDelay > 0) {
    scheduleChatFlush(chatId, queue);
    return;
  }

  queue.processing = true;
  const batchMessages = queue.messages.splice(0);
  const batch = formatMessageBatch(batchMessages);
  const ctx = queue.latestContext;

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
    queue.processing = false;

    // Messages received while Molly was replying form the next batch.
    if (queue.messages.length > 0) scheduleChatFlush(chatId, queue);
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
      lastMessageAt: 0,
      processing: false,
    };
    chatQueues.set(chatId, queue);
  }

  queue.messages.push(text);
  queue.latestContext = ctx;
  queue.lastMessageAt = Date.now();

  // Every new message restarts the quiet-period timer.
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