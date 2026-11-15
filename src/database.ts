import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";

export interface UserProfile {
  telegramId: string;
  affection: number;
  relationship: "creator" | "acquaintance";
  isCreator: boolean;
}

interface UserRow {
  telegram_id: string;
  affection: number;
  relationship: "creator" | "acquaintance";
}

const databasePath = resolve(process.cwd(), "data", "molly.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma("journal_mode = WAL");

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    affection INTEGER NOT NULL DEFAULT 0 CHECK (affection BETWEEN 0 AND 100),
    relationship TEXT NOT NULL DEFAULT 'acquaintance',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertUser = database.prepare(`
  INSERT OR IGNORE INTO users (telegram_id, affection, relationship)
  VALUES (?, ?, ?)
`);

const refreshCreator = database.prepare(`
  UPDATE users
  SET affection = 100,
      relationship = 'creator',
      last_seen = CURRENT_TIMESTAMP
  WHERE telegram_id = ?
`);

const touchUser = database.prepare(`
  UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE telegram_id = ?
`);

const findUser = database.prepare(
  "SELECT telegram_id, affection, relationship FROM users WHERE telegram_id = ?",
);

export function getOrCreateUser(telegramId: number): UserProfile {
  const id = String(telegramId);
  const isCreator = id === config.creatorTelegramId;

  insertUser.run(
    id,
    isCreator ? 100 : 0,
    isCreator ? "creator" : "acquaintance",
  );

  if (isCreator) {
    // The creator's affection is fixed at the maximum and cannot decay.
    refreshCreator.run(id);
  } else {
    touchUser.run(id);
  }

  const row = findUser.get(id) as UserRow | undefined;
  if (!row) {
    throw new Error("Could not load the Telegram user profile.");
  }

  return {
    telegramId: row.telegram_id,
    affection: row.affection,
    relationship: row.relationship,
    isCreator,
  };
}

export function initializeDatabase(): void {
  // Create the creator's permanent profile even before their first message.
  getOrCreateUser(Number(config.creatorTelegramId));
}