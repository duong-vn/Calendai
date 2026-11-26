import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';

const StoredAdminConfigSchema = z.object({
  primaryModel: z.string().trim().min(1).max(200),
  fallbackModel: z.string().trim().min(1).max(200).nullable(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

export interface AdminModelConfig {
  primaryModel: string;
  fallbackModel: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

export class ProviderCatalogError extends Error {
  constructor(message = 'Không thể kiểm tra danh sách model từ nhà cung cấp AI. Vui lòng thử lại sau.') {
    super(message);
    this.name = 'ProviderCatalogError';
  }
}

/*
 * Note on Vercel ephemeral filesystem:
 * Server-persisted model configuration lives in a JSON file (`data/admin-config.json` locally,
 * or `/tmp/calendai-admin-config.json` on Vercel where the deployment root is read-only).
 * Because serverless filesystems are ephemeral, saved overrides may reset to `AI_MODEL` /
 * `AI_FALLBACK_MODEL` env defaults across deployments or cold starts.
 */
let cachedConfig: { path: string; config: AdminModelConfig } | null = null;

function getFallbackTmpConfigPath(): string {
  return path.join('/tmp', 'calendai-admin-config.json');
}

export function resolveAdminConfigPath(): string {
  const override = process.env.ADMIN_CONFIG_PATH?.trim();
  if (override) {
    return path.resolve(override);
  }
  if (process.env.VERCEL) {
    return getFallbackTmpConfigPath();
  }
  return path.join(process.cwd(), 'data', 'admin-config.json');
}

export function resetAdminModelConfigCache(): void {
  cachedConfig = null;
}

function getEnvDefaultConfig(): AdminModelConfig {
  const env = getServerEnv();
  const primaryModel = env.AI_MODEL.trim();
  const fallbackRaw = env.AI_FALLBACK_MODEL?.trim();
  const fallbackModel = fallbackRaw && fallbackRaw !== primaryModel ? fallbackRaw : null;
  return {
    primaryModel,
    fallbackModel,
  };
}

function readConfigFromFile(filePath: string): AdminModelConfig | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = StoredAdminConfigSchema.safeParse(parsedJson);
    if (!parsed.success) return null;
    const primaryModel = parsed.data.primaryModel.trim();
    const fallbackModel =
      parsed.data.fallbackModel && parsed.data.fallbackModel.trim() !== primaryModel
        ? parsed.data.fallbackModel.trim()
        : null;
    return {
      primaryModel,
      fallbackModel,
      ...(parsed.data.updatedAt ? { updatedAt: parsed.data.updatedAt } : {}),
      ...(parsed.data.updatedBy ? { updatedBy: parsed.data.updatedBy } : {}),
    };
  } catch {
    return null;
  }
}

function writeConfigFile(filePath: string, config: AdminModelConfig): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = `${JSON.stringify(config, null, 2)}\n`;
  const tempPath = path.join(
    dir,
    `.admin-config.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );
  try {
    fs.writeFileSync(tempPath, payload, 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Ignore temp cleanup failure
    }
    if ((error as NodeJS.ErrnoException)?.code === 'EXDEV') {
      fs.writeFileSync(filePath, payload, 'utf8');
      return;
    }
    throw error;
  }
}

/**
 * Reads the active primary and fallback AI models from memory cache or disk,
 * falling back to environment defaults (`AI_MODEL` / `AI_FALLBACK_MODEL`) when no
 * persisted config file exists. Env defaults are never cached so env overrides
 * in tests or runtime remain live until an explicit admin save occurs.
 */
export function getAdminModelConfig(): AdminModelConfig {
  const primaryPath = resolveAdminConfigPath();
  if (cachedConfig && (cachedConfig.path === primaryPath || cachedConfig.path === getFallbackTmpConfigPath())) {
    return cachedConfig.config;
  }

  const fromPrimary = readConfigFromFile(primaryPath);
  if (fromPrimary) {
    cachedConfig = { path: primaryPath, config: fromPrimary };
    return fromPrimary;
  }

  if (!process.env.ADMIN_CONFIG_PATH?.trim()) {
    const tmpPath = getFallbackTmpConfigPath();
    if (tmpPath !== primaryPath) {
      const fromTmp = readConfigFromFile(tmpPath);
      if (fromTmp) {
        cachedConfig = { path: tmpPath, config: fromTmp };
        return fromTmp;
      }
    }
  }

  return getEnvDefaultConfig();
}

export function saveAdminModelConfig(input: {
  primaryModel: string;
  fallbackModel: string | null;
  updatedBy?: string;
}): AdminModelConfig {
  const primaryModel = input.primaryModel.trim();
  const fallbackModel = input.fallbackModel?.trim() || null;

  if (!primaryModel) {
    throw new Error('Model chính không được để trống.');
  }
  if (fallbackModel && fallbackModel === primaryModel) {
    throw new Error('Model chính và model dự phòng không được trùng nhau.');
  }

  const nextConfig: AdminModelConfig = {
    primaryModel,
    fallbackModel,
    updatedAt: new Date().toISOString(),
    ...(input.updatedBy ? { updatedBy: input.updatedBy } : {}),
  };

  let targetPath = resolveAdminConfigPath();
  try {
    writeConfigFile(targetPath, nextConfig);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    const isReadOnlyDefault =
      !process.env.ADMIN_CONFIG_PATH?.trim() && (code === 'EROFS' || code === 'EACCES');
    if (!isReadOnlyDefault) {
      throw error;
    }
    targetPath = getFallbackTmpConfigPath();
    console.warn('[admin-config] Default data directory is read-only; falling back to /tmp storage.');
    writeConfigFile(targetPath, nextConfig);
  }

  cachedConfig = { path: targetPath, config: nextConfig };
  return nextConfig;
}

/**
 * Fetches the set of valid model IDs from the configured OpenAI-compatible provider.
 */
export async function fetchProviderModelIds(signal?: AbortSignal): Promise<Set<string>> {
  const env = getServerEnv();
  let response: Response;
  try {
    response = await fetch(`${env.AI_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Calendai',
      },
      next: { revalidate: 3600 },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ProviderCatalogError();
  }

  if (!response.ok) {
    throw new ProviderCatalogError();
  }

  let catalog: unknown;
  try {
    catalog = await response.json();
  } catch {
    throw new ProviderCatalogError();
  }

  if (!catalog || typeof catalog !== 'object' || !('data' in catalog) || !Array.isArray(catalog.data)) {
    throw new ProviderCatalogError();
  }

  const ids = new Set<string>();
  for (const item of catalog.data) {
    if (item !== null && typeof item === 'object' && 'id' in item && typeof item.id === 'string' && item.id.trim()) {
      ids.add(item.id.trim());
    }
  }

  if (ids.size === 0) {
    throw new ProviderCatalogError();
  }

  return ids;
}
