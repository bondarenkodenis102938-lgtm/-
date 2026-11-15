# Technical Plan — Molly Telegram Bot

**Status:** first runnable scaffold committed; local setup and live API testing are the next steps.

## Architecture

```
Telegram
  -> Telegraf bot (Node.js + TypeScript)
  -> Molly personality prompt + temporary chat history
  -> TokenReply API (OpenAI-compatible Chat Completions)
  -> Telegram reply
```

## Stack

- Node.js 22+
- TypeScript
- Telegraf
- OpenAI Node SDK configured with TokenReply's compatible API base URL
- In-memory conversation history; no database in v1

## Current implementation

- `src/index.ts`: Telegram bot, commands, text handling, safe message splitting, and graceful shutdown.
- `src/config.ts`: validates environment variables.
- `src/personality.ts`: Molly's initial system prompt.
- `src/history.ts`: temporary conversation history, separated by chat ID.
- `src/ai.ts`: TokenReply Chat Completions client.
- `.env.example`: local configuration template.
- `.gitignore`: excludes local secrets and build output.

The first version handles private chats only so group conversations cannot accidentally share one history. Streaming is not enabled yet; the initial version waits for the completed response.

## Conversation context and memory

For v1, keep only temporary conversation history per private Telegram chat in the running process. Do not introduce a database or persistent user profile unless the product requirements change.

- `/clear` clears the current chat's stored conversation history.
- Restarting the bot clears in-memory history; this is expected for the no-long-term-memory first version.
- Only the current conversation context is passed to the model.
- Molly must not claim to remember information across separate sessions.

## Initial bot commands

| Command | Current behavior |
|---|---|
| `/start` | Introduces Molly |
| `/clear` | Clears the current chat's context |
| `/model` | Shows the configured model |
| `/help` | Lists available commands |

Changing the model from Telegram is not implemented yet; set `TOKENREPLY_MODEL` in `.env`.

## TokenReply integration

The implementation uses the OpenAI-compatible Chat Completions endpoint:

- Base URL: `https://api.tokenreply.com/v1`
- Endpoint: `/chat/completions`
- Authentication: Bearer API key
- Model: configured through `TOKENREPLY_MODEL`

The exact model ID must be available to the user's TokenReply account. Do not assume every model is available on every plan or API key.

## Configuration and security

- Store the Telegram bot token, TokenReply API key, API base URL, and model selection in environment variables.
- Use a local `.env` file for development.
- Commit only `.env.example` with placeholder values.
- `.env` is excluded by `.gitignore`.
- Never paste API secrets into chat or commit secrets to GitHub.

## Reliability and current limitations

- The API client has a 60-second timeout and retries transient failures.
- API errors are logged locally and the user receives a friendly fallback message.
- Long Telegram replies are split into chunks.
- History is held in process memory and is lost when the bot restarts.
- Streaming, persistent storage, per-user settings, and automated tests are not implemented yet.
- Run `npm run typecheck` and `npm run build` locally after installing dependencies.

## Local setup

See the root [README](../README.md) for Windows CMD and PowerShell setup instructions.