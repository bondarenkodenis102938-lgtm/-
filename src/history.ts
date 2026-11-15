import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const conversations = new Map<number, ChatCompletionMessageParam[]>();

export function getHistory(chatId: number): ChatCompletionMessageParam[] {
  return conversations.get(chatId) ?? [];
}

export function addMessage(
  chatId: number,
  message: ChatCompletionMessageParam,
  maxMessages: number,
): void {
  const history = getHistory(chatId);
  history.push(message);

  if (history.length > maxMessages) {
    history.splice(0, history.length - maxMessages);
  }

  conversations.set(chatId, history);
}

export function clearHistory(chatId: number): void {
  conversations.delete(chatId);
}