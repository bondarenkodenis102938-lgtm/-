# Technical Plan — Molly Telegram Bot

**Status:** initial plan; implementation not started.

## Architecture

```
Telegram
  -> Telegraf bot (Node.js + TypeScript)
  -> Molly personality / prompt layer
  -> TokenReply API (OpenAI-compatible chat completions)
  -> Telegram reply
```

## Stack

- Node.js
- TypeScript
- Telegraf
- TokenReply API
- In-memory conversation history for the first version

## Conversation context and memory

For v1, keep only temporary conversation history per Telegram chat in the running process. Do not introduce a database or persistent user profile unless the product requirements change.

- `/clear` must clear the current chat's stored conversation history.
- Restarting the bot may clear in-memory history; this is acceptable for the no-long-term-memory first version.
- Only pass the current conversation context to the model.
- Do not claim that Molly remembers information across separate sessions.

## Initial bot commands

| Command | Purpose |
|---|---|
| `/start` | Introduce Molly and start chatting |
| `/clear` | Clear the current conversation context |
| `/model` | Show or change the selected model |
| `/help` | Explain available commands |

## TokenReply integration

The intended integration is an OpenAI-compatible chat-completions request using a Bearer API key. The previously discussed base URL was:

`https://api.tokenreply.com/v1`

The chat-completions path discussed was:

`/chat/completions`

Verify the current TokenReply documentation and the selected model's capabilities during implementation. Do not hard-code assumptions about model names or streaming support.

## Configuration and security

- Store the Telegram bot token, TokenReply API key, API base URL, and model selection in environment variables.
- Use a local `.env` file for development.
- Commit only a `.env.example` containing placeholder values.
- Add `.env` to `.gitignore`.
- Never ask the user to paste API secrets into chat or commit secrets to GitHub.

## Reliability and Telegram constraints

- Handle network failures, invalid API responses, timeouts, and rate limits.
- Keep Telegram message-length limits in mind; split long model replies into safe chunks.
- If streaming is implemented, edit Telegram messages carefully and avoid excessive update frequency.
- Prevent overlapping updates from corrupting the same conversation history.

## Suggested initial source layout

```
src/
  index.ts
  config.ts
  telegram.ts
  ai.ts
  personality.ts
  history.ts
.env.example
.gitignore
package.json
tsconfig.json
README.md
```

This is a proposed layout, not an existing implementation.
