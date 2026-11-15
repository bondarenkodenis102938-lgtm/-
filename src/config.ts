import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const historyLimit = Number(process.env.HISTORY_MAX_MESSAGES ?? 24);

if (!Number.isInteger(historyLimit) || historyLimit < 2) {
  throw new Error("HISTORY_MAX_MESSAGES must be an integer of at least 2.");
}

export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  tokenReplyApiKey: required("TOKENREPLY_API_KEY"),
  tokenReplyModel: required("TOKENREPLY_MODEL"),
  tokenReplyBaseUrl:
    process.env.TOKENREPLY_BASE_URL?.trim() ||
    "https://api.tokenreply.com/v1",
  historyMaxMessages: historyLimit,
} as const;