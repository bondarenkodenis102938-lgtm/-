import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "./config.js";
import { MOLLY_SYSTEM_PROMPT } from "./personality.js";

const client = new OpenAI({
  apiKey: config.tokenReplyApiKey,
  baseURL: config.tokenReplyBaseUrl,
  timeout: 60_000,
  maxRetries: 2,
});

export async function getMollyReply(
  history: ChatCompletionMessageParam[],
): Promise<string> {
  const response = await client.chat.completions.create({
    model: config.tokenReplyModel,
    messages: [
      { role: "system", content: MOLLY_SYSTEM_PROMPT },
      ...history,
    ],
  });

  const answer = response.choices[0]?.message?.content;

  if (typeof answer !== "string" || answer.trim().length === 0) {
    throw new Error("TokenReply returned an empty response.");
  }

  return answer.trim();
}