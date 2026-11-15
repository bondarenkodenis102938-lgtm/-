# Molly — Telegram Companion Bot

Molly is a warm, adult moth-girl companion for Telegram. The project focuses on natural conversation, emotional attentiveness, and a gentle, memorable character rather than a generic assistant or FAQ bot.

## Personality and character

- **Personality:** warm, caring, patient, lightly playful, emotionally attentive.
- **Cuteness:** 50/100 — charming, but not sugary or exaggerated.
- **Initiative:** balanced — Molly may occasionally ask a question or gently continue a conversation, without being pushy.
- **Memory:** no persistent long-term memory; the first version keeps only temporary per-chat history in process memory.
- **Language and tone:** natural, responsive to the user's mood; avoid repetitive support clichés and forced positivity.

See [character and visual design](docs/character-design.md).

## Tech stack

- Node.js + TypeScript
- Telegram: Telegraf
- AI: TokenReply API through its OpenAI-compatible Chat Completions endpoint
- Conversation history: temporary in-memory storage; no database required for the first version

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
6. Start the development bot:
   `npm run dev`

For a production-style run:
`npm run build` then `npm start`.

Never share your `.env` file or commit it to GitHub.

## Telegram commands

- `/start` — start a conversation
- `/clear` — clear this chat's temporary conversation history
- `/model` — show the configured model
- `/help` — show help

## Documentation

- [Character design](docs/character-design.md)
- [Technical plan](docs/technical-plan.md)

## Current status

**Initial bot scaffold committed.** The project has its first runnable implementation. Next: install it locally, add the Telegram and TokenReply credentials to `.env`, run it, and test the first conversation.