# Molly — Telegram Companion Bot

Molly is a warm, adult moth-girl companion for Telegram. The project focuses on natural conversation, emotional attentiveness, and a gentle, memorable character rather than a generic assistant or FAQ bot.

## Personality and character

Molly is a kind, cheerful, gentle moth-girl. She is caring and sensitive, has studied psychology, enjoys affection and hugs, and expresses herself through the movements of her wings and antennae.

See [character and visual design](docs/character-design.md).

## User profiles and relationships

- SQLite stores a persistent profile for each Telegram account, identified by its numeric Telegram user ID.
- Each profile has an affection score from 0 to 100 and a relationship type.
- The creator ID is configured with `MOLLY_CREATOR_ID` (defaults to `5183481556`).
- The creator profile is always kept at 100/100 affection and marked as `creator`; Molly receives this relationship context with each message.
- Other users start with 0/100. Their profiles are separate.
- The database is stored locally at `data/molly.sqlite` and is excluded from Git.

## Tech stack

- Node.js + TypeScript
- Telegram: Telegraf
- AI: TokenReply API through its OpenAI-compatible Chat Completions endpoint
- Conversation history: temporary in-memory storage per private chat
- User profiles and affection: persistent SQLite database

## Run locally

1. Install Node.js 22 or newer.
2. Clone this repository and open its folder in a terminal.
3. Install dependencies:
   `npm install`
4. Create your local environment file:
   - Windows CMD: `copy .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
5. Open `.env` and fill in:
   - `TELEGRAM_BOT_TOKEN` — create a bot with Telegram's [@BotFather](https://t.me/BotFather).
   - `TOKENREPLY_API_KEY` — your private TokenReply API key.
   - `TOKENREPLY_MODEL` — an exact model ID available to your TokenReply account.
   - `MOLLY_CREATOR_ID` — creator's Telegram numeric ID (defaults to `5183481556`).
6. Start the development bot:
   `npm run dev`

For a production-style run:
`npm run build` then `npm start`.

Never share your `.env` file or commit API secrets or the SQLite database to GitHub.

## Telegram commands

- `/start` — start a conversation
- `/clear` — clear this chat's temporary conversation history
- `/model` — show the configured model
- `/help` — help

## Documentation

- [Character design](docs/character-design.md)
- [Technical plan](docs/technical-plan.md)

## Current status

The bot supports TokenReply chat completions, temporary per-chat conversation history, and persistent SQLite user profiles with a protected creator relationship.