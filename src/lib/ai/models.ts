export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  badge?: string;
  isFree?: boolean;
  supportsTools?: boolean;
  contextLength?: number;
  description: string;
}

export function formatModelOption(
  rawId: string,
  rawName?: string,
  description?: string
): AIModelOption {
  const parts = rawId.split('/');
  const shortName = rawName || (parts.length > 1 ? parts[1] : rawId);
  const provider = parts.length > 1 ? parts[0] : 'AI';

  return {
    id: rawId,
    name: shortName,
    provider: provider,
    description: description || `Mô hình ${rawId}`,
  };
}

export function getModelById(
  id: string,
  knownModels: AIModelOption[] = []
): AIModelOption {
  const found = knownModels.find((m) => m.id === id);
  if (found) return found;
  return formatModelOption(id);
}
