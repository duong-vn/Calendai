import { createOpenAI } from '@ai-sdk/openai';
import { getServerEnv } from '@/lib/env';

export function getAIProvider() {
  const env = getServerEnv();
  return createOpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: env.AI_BASE_URL,
    headers: {
      'HTTP-Referer': env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Calendai',
    },
  });
}

// Backward-compatible alias
export const getOpenRouterProvider = getAIProvider;

export function getChatModel(modelId?: string) {
  const env = getServerEnv();
  const provider = getAIProvider();
  const targetModel = modelId?.trim() ? modelId.trim() : env.AI_MODEL;
  return provider.chat(targetModel);
}
