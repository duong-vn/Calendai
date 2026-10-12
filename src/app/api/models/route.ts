import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { formatModelOption, type AIModelOption } from '@/lib/ai/models';

export const revalidate = 3600;

interface RawAIModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  supported_parameters?: string[];
}

export async function GET() {
  try {
    const env = getServerEnv();
    const endpoint = `${env.AI_BASE_URL}/models`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Calendai',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`AI models API returned status ${response.status}`);
    }

    const json = await response.json();
    const rawModels: RawAIModel[] = Array.isArray(json?.data) ? json.data : [];

    if (rawModels.length === 0) {
      throw new Error('Empty model list from AI provider');
    }

    const defaultModelId = env.AI_MODEL;

    const models: AIModelOption[] = rawModels.map((m) => {
      const isFree = Boolean(
        m.id.endsWith(':free') ||
          (m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      );
      const supportsTools = Boolean(m.supported_parameters?.includes('tools'));
      const formatted = formatModelOption(m.id, m.name, m.description);

      let badge: string | undefined;
      if (m.id === defaultModelId) {
        badge = 'Mặc định';
      } else if (isFree) {
        badge = 'Free';
      }

      return {
        ...formatted,
        badge,
        isFree,
        supportsTools,
        contextLength: m.context_length,
      };
    });

    // Sort: configured default model first, then models with tools, then alphabetically
    models.sort((a, b) => {
      if (a.id === defaultModelId) return -1;
      if (b.id === defaultModelId) return 1;
      if (a.supportsTools && !b.supportsTools) return -1;
      if (!a.supportsTools && b.supportsTools) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      defaultModel: defaultModelId,
      total: models.length,
      models,
    });
  } catch (error) {
    const defaultModelId = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || '';
    const fallbackModel: AIModelOption = {
      ...formatModelOption(defaultModelId),
      badge: 'Mặc định',
    };

    const errorMsg = error instanceof Error ? error.message : 'Fallback to default model';
    return NextResponse.json({
      success: false,
      defaultModel: defaultModelId,
      total: 1,
      models: [fallbackModel],
      error: errorMsg,
    });
  }
}
