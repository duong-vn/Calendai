export type ExternalLinkKind = 'meet' | 'calendar' | 'any';

export function safeHttpsUrl(
  input: string | null | undefined,
  kind: ExternalLinkKind = 'any'
): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return null;
    }
    if (kind === 'meet') {
      if (url.hostname !== 'meet.google.com' || url.port) return null;
    }
    if (kind === 'calendar') {
      if (
        (url.hostname !== 'calendar.google.com' && url.hostname !== 'www.google.com') ||
        url.port
      ) {
        return null;
      }
    }
    return url.href;
  } catch {
    return null;
  }
}

export function safeMarkdownUrl(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || /[\u0000-\u001F\u007F\s]/.test(trimmed)) return null;

  const httpsUrl = safeHttpsUrl(trimmed, 'any');
  if (httpsUrl) return httpsUrl;

  try {
    const url = new URL(trimmed);
    if (
      url.protocol !== 'mailto:' ||
      url.username ||
      url.password ||
      url.hostname ||
      !url.pathname.trim()
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
