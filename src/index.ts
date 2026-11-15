import { Context, Telegraf } from "telegraf";
import { getMollyGroupDecision, getMollyReply } from "./ai.js";
import { config } from "./config.js";
import { getOrCreateUser, initializeDatabase } from "./database.js";
import { addMessage, clearHistory, getHistory } from "./history.js";
import { getRelationshipContext } from "./relationship.js";

const bot = new Telegraf(config.telegramToken);

const MESSAGE_DEBOUNCE_MS = 5_000;
const GROUP_ACTIVE_MS = 15 * 60_000;
const GROUP_REPLY_COOLDOWN_MS = 45_000;
const MAX_GROUP_REPLIES_PER_SESSION = 5;
const MAX_GROUP_CONTEXT_MESSAGES = 30;

interface ChatQueue {
  messages: string[];
  latestContext: Context;
  timer: ReturnType<typeof setTimeout> | null;
  lastMessageAt: number;
  processing: boolean;
}

interface GroupMessage {
  sequence: number;
  text: string;
}

interface GroupMode {
  activeUntil: number;
  responses: number;
  lastResponseAt: number;
  sequence: number;
  lastAnalyzedSequence: number;
  messages: GroupMessage[];
  latestContext: Context;
  timer: ReturnType<typeof setTimeout> | null;
  processing: boolean;
}

const chatQueues = new Map<number, ChatQueue>();
const groupModes = new Map<number, GroupMode>();

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
    try {
      await ctx.sendChatAction("typing");
    } catch (error) {
      console.warn("Could not send typing status; continuing:", error);
    }

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
    try {
      await ctx.reply(
        "Ой, у меня не получилось ответить. Попробуй ещё раз чуть позже 🥺",
      );
    } catch (sendError) {
      console.error("Could not send error reply:", sendError);
    }
  } finally {
    queue.processing = false;
    if (queue.messages.length > 0) scheduleChatFlush(chatId, queue);
  }
}

function normalizeTrigger(text: string): string {
  return text
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getOrCreateGroupMode(chatId: number, ctx: Context): GroupMode {
  let mode = groupModes.get(chatId);

  if (!mode) {
    mode = {
      activeUntil: 0,
      responses: 0,
      lastResponseAt: 0,
      sequence: 0,
      lastAnalyzedSequence: 0,
      messages: [],
      latestContext: ctx,
      timer: null,
      processing: false,
    };
    groupModes.set(chatId, mode);
  }

  return mode;
}

function scheduleGroupAnalysis(chatId: number, mode: GroupMode): void {
  if (mode.timer) clearTimeout(mode.timer);

  const quietPeriodRemaining =
    MESSAGE_DEBOUNCE_MS - (Date.now() - mode.messages[mode.messages.length - 1]!.sequence /* replaced below */);
  void quietPeriodRemaining;

  mode.timer = setTimeout(() => {
    mode.timer = null;
    void processGroupMessages(chatId, mode);
  }, MESSAGE_DEBOUNCE_MS);
}

async function processGroupMessages(chatId: number, mode: GroupMode): Promise<void> {
  if (mode.processing || mode.activeUntil <= Date.now()) return;
  if (mode.sequence <= mode.lastAnalyzedSequence) return;

  const cooldownRemaining =
    mode.lastResponseAt + GROUP_REPLY_COOLDOWN_MS - Date.now();

  if (cooldownRemaining > 0) {
    mode.timer = setTimeout(() => {
      mode.timer = null;
      void processGroupMessages(chatId, mode);
    }, cooldownRemaining);
    return;
  }

  mode.processing = true;
  const snapshotSequence = mode.sequence;
  const contextMessages = mode.messages.map((message) => message.text);
  const ctx = mode.latestContext;

  try {
    try {
      await ctx.sendChatAction("typing");
    } catch (error) {
      console.warn("Could not send group typing status; continuing:", error);
    }

    const decision = await getMollyGroupDecision(contextMessages);
    mode.lastAnalyzedSequence = snapshotSequence;

    // The creator may have put Molly to sleep while the AI was thinking.
    if (mode.activeUntil <= Date.now()) return;

    if (decision.action === "respond") {
      for (const chunk of splitTelegramMessage(decision.reply)) {
        await ctx.reply(chunk);
      }

      mode.lastResponseAt = Date.now();
      mode.responses += 1;

      if (mode.responses >= MAX_GROUP_REPLIES_PER_SESSION) {
        mode.activeUntil = 0;
        mode.messages = [];
        if (mode.timer) clearTimeout(mode.timer);
        mode.timer = null;
        await ctx.reply("Я немного побуду в тишине. Если понадоблюсь — позови меня снова 🦋");
      }
    }
  } catch (error) {
    mode.lastAnalyzedSequence = snapshotSequence;
    console.error("Group observation error:", error);
  } finally {
    mode.processing = false;

    if (
      mode.activeUntil > Date.now() &&
      mode.sequence > mode.lastAnalyzedSequence &&
      !mode.timer
    ) {
      scheduleGroupAnalysis(chatId, mode);
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
  const text = ctx.message.text.trim();
  if (!text || !ctx.from || ctx.from.is_bot) return;

  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    const chatId = ctx.chat.id;
    const mode = getOrCreateGroupMode(chatId, ctx);
    const trigger = normalizeTrigger(text);
    const isCreator = String(ctx.from.id) === config.creatorTelegramId;

    if (isCreator && trigger === "молли проснись") {
      if (mode.timer) clearTimeout(mode.timer);
      mode.timer = null;
      mode.activeUntil = Date.now() + GROUP_ACTIVE_MS;
      mode.responses = 0;
      mode.lastResponseAt = 0;
      mode.sequence = 0;
      mode.lastAnalyzedSequence = 0;
      mode.messages = [];
      mode.latestContext = ctx;
      await ctx.reply("Я проснулась! Буду немного наблюдать за беседой и иногда подключаться, если мне будет что сказать. У меня есть 15 минут 🦋");
      return;
    }

    if (isCreator && trigger === "молли спать") {
      mode.activeUntil = 0;
      mode.messages = [];
      mode.lastAnalyzedSequence = mode.sequence;
      if (mode.timer) clearTimeout(mode.timer);
      mode.timer = null;
      await ctx.reply("Уже засыпаю. Позови, когда понадоблюсь 💤");
      return;
    }

    if (mode.activeUntil <= Date.now()) {
      mode.activeUntil = 0;
      return;
    }

    mode.sequence += 1;
    const senderName = ctx.from.first_name || ctx.from.username || "Участник";
    mode.messages.push({
      sequence: mode.sequence,
      text: `${senderName}: ${text}`,
    });

    if (mode.messages.length > MAX_GROUP_CONTEXT_MESSAGES) {
      mode.messages.splice(0, mode.messages.length - MAX_GROUP_CONTEXT_MESSAGES);
    }

    mode.latestContext = ctx;
    scheduleGroupAnalysis(chatId, mode);
    return;
  }

  // Private companion chats keep their own independent message queue.
  if (ctx.chat.type !== "private" || text.startsWith("/")) return;

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