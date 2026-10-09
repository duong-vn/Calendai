import { createOpenAI } from '@ai-sdk/openai';
import { getServerEnv } from '@/lib/env';

export function getOpenRouterProvider() {
  const env = getServerEnv();
  return createOpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    headers: {
      'HTTP-Referer': env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Calendai AI Assistant',
    },
  });
}

export function getChatModel() {
  const env = getServerEnv();
  const provider = getOpenRouterProvider();
  return provider.chat(env.OPENROUTER_MODEL);
}
