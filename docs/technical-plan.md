# Technical Plan — Molly Telegram Bot

**Status:** runnable Telegram bot with TokenReply integration, temporary chat history, and persistent user profiles.

## Architecture

```
Telegram
  -> Telegraf bot (Node.js + TypeScript)
  -> SQLite user profile lookup by Telegram user ID
  -> Molly character + relationship context + temporary chat history
  -> TokenReply API (OpenAI-compatible Chat Completions)
  -> Telegram reply
```

## Stack

- Node.js 22+
- TypeScript
- Telegraf
- OpenAI Node SDK configured with TokenReply's compatible API base URL
- better-sqlite3 for persistent user profiles
- In-memory conversation history per private chat

## Current implementation

- `src/index.ts`: Telegram bot, commands, user lookup, safe message splitting, and graceful shutdown.
- `src/config.ts`: validates environment variables, including the creator Telegram ID.
- `src/personality.ts`: Molly's character prompt.
- `src/history.ts`: temporary conversation history.
- `src/database.ts`: SQLite database and user profiles.
- `src/relationship.ts`: relationship context supplied to the AI.
- `src/ai.ts`: TokenReply Chat Completions client.

## User profiles and relationships

- Telegram's numeric sender ID (`ctx.from.id`) is the stable account identifier; usernames and display names are not used for identity.
- IDs are stored as text in SQLite to avoid accidental numeric conversion.
- Each user receives a profile on first contact.
- New users start at affection 0/100 with the `acquaintance` relationship.
- The creator ID is configured by `MOLLY_CREATOR_ID`, defaulting to `5183481556`.
- The creator's profile is created during startup and whenever they contact the bot.
- Creator affection is reset to 100 on profile lookup and its relationship is always `creator`; ordinary profile operations cannot reduce it.
- The AI receives a short relationship context so it can recognize the creator and the special, quietly adoring relationship.
- Future affection progression for other users can be added separately without changing Telegram identity lookup.

## Data storage

- SQLite file: `data/molly.sqlite`.
- The `data/` directory is excluded from Git.
- User profiles persist across bot restarts.
- Conversation history remains in memory and is still cleared by restart or `/clear`.

## TokenReply integration

- Base URL: `https://api.tokenreply.com/v1`
- Endpoint: `/chat/completions`
- Authentication: Bearer API key
- Model: configured through `TOKENREPLY_MODEL`

## Configuration and security

- Store Telegram and TokenReply secrets in local `.env`.
- Store the creator ID in `MOLLY_CREATOR_ID`.
- Commit only `.env.example`; never commit `.env` or `data/molly.sqlite`.

## Reliability and current limitations

- The API client has a 60-second timeout and retries transient failures.
- API errors are logged locally and the user receives a friendly fallback error.
- Long Telegram replies are split into chunks.
- Persistent profiles are implemented; dynamic affection changes, relationship levels, and persistent conversation memory are not yet implemented.
- Run `npm install`, `npm run typecheck`, and `npm run build` locally after pulling changes.