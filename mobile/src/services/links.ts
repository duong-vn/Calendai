import { Linking } from 'react-native';

export function safeHttpsUrl(input: string, kind: 'meet' | 'calendar' | 'any' = 'any'): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (kind === 'meet' && url.hostname !== 'meet.google.com') return null;
    if (kind === 'calendar' && url.hostname !== 'calendar.google.com' && url.hostname !== 'www.google.com') return null;
    return url.href;
  } catch { return null; }
}
export async function openLink(input: string, kind: 'meet' | 'calendar' | 'any' = 'any'): Promise<void> {
  const url = safeHttpsUrl(input, kind);
  if (!url) throw new Error('Đường dẫn không hợp lệ hoặc không dùng HTTPS.');
  try { await Linking.openURL(url); } catch { throw new Error('Không mở được đường dẫn trên thiết bị này.'); }
}
