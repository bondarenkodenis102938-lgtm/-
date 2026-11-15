# Molly — Telegram Companion Bot

Molly is a warm, adult moth-girl companion for Telegram. The project focuses on natural conversation, emotional attentiveness, and a gentle, memorable character rather than a generic assistant or FAQ bot.

## Current product decisions

- **Personality:** warm, caring, patient, lightly playful, emotionally attentive.
- **Cuteness:** 50/100 — charming, but not sugary or exaggerated.
- **Initiative:** balanced — Molly may occasionally ask a question or gently continue a conversation, without being pushy.
- **Memory:** no persistent long-term memory in the first version; use only the current conversation context.
- **Language and tone:** natural, responsive to the user's mood; avoid repetitive support clichés and forced positivity.

## First-version technical direction

- Node.js + TypeScript
- Telegram bot framework: Telegraf
- AI access: TokenReply API (OpenAI-compatible chat completions interface)
- Conversation history: temporary per-chat history in process memory; no database is required for the initial version.
- Commands: `/start`, `/clear`, `/model`, `/help`
- Secrets: environment variables in a local `.env` file; never commit API keys.
- Handle API errors, rate limits, Telegram message-length limits, and split long replies safely.
- Streaming may be added if it is supported reliably by the selected model/API.

## Documentation

- [Molly character and visual design](docs/character-design.md)
- [Technical plan](docs/technical-plan.md)

## Status

**Planning / character definition.** No production bot implementation has been committed yet. Character and technical decisions may evolve as the project is built.
