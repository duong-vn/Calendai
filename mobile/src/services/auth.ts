import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { parseSession, type MobileSession } from '../types';
import { API_ORIGIN, ApiError, nativeFetch, readJson, type Fetcher } from './transport';

const STORE_KEY = 'calendai.mobile.session.v1';
const STORE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const REFRESH_WINDOW = 90_000;
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

interface SessionStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string, options: typeof STORE_OPTIONS): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export class AuthClient {
  private current: MobileSession | null = null;
  private revision = 0;
  private refreshFlight: Promise<string> | null = null;
  private writes = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(private readonly store: SessionStore = SecureStore, private readonly fetcher: Fetcher = nativeFetch, private readonly now = Date.now) {}
  getSnapshot = () => this.current;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  private persist(value: MobileSession | null): Promise<void> {
    const operation = this.writes.catch(() => undefined).then(() => value
      ? this.store.setItemAsync(STORE_KEY, JSON.stringify({ origin: API_ORIGIN, ...value }), STORE_OPTIONS)
      : this.store.deleteItemAsync(STORE_KEY));
    this.writes = operation;
    return operation;
  }
  async restore(): Promise<void> {
    const revision = this.revision;
    const raw = await this.store.getItemAsync(STORE_KEY);
    if (!raw || revision !== this.revision) return;
    let restored: MobileSession;
    try {
      const stored: unknown = JSON.parse(raw);
      if (!stored || typeof stored !== 'object' || !('origin' in stored) || stored.origin !== API_ORIGIN) throw new Error();
      restored = parseSession(stored);
      if (restored.expiresAt <= this.now()) throw new Error();
    } catch {
      await this.persist(null);
      throw new Error('Phiên đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
    }
    if (revision !== this.revision) return;
    this.current = restored;
    this.emit();
  }
  async exchange(code: string): Promise<void> {
    const revision = ++this.revision;
    const response = await this.fetcher(`${API_ORIGIN}/api/auth/mobile/exchange`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const next = parseSession(await readJson(response));
    if (revision !== this.revision) return;
    if (next.expiresAt <= this.now() || next.accessTokenExpiresAt <= this.now()) throw new Error('Máy chủ trả phiên đã hết hạn.');
    await this.persist(next);
    if (revision !== this.revision) return;
    this.current = next;
    this.emit();
  }
  async clear(): Promise<void> {
    ++this.revision;
    this.current = null;
    this.refreshFlight = null;
    this.emit();
    await this.persist(null);
  }
  async authorization(forceRefresh = false): Promise<string> {
    const current = this.current;
    if (!current) throw new ApiError('Vui lòng đăng nhập Google để tiếp tục.', 401);
    if (current.expiresAt <= this.now()) {
      await this.clear();
      throw new ApiError('Phiên đã hết hạn. Vui lòng đăng nhập lại.', 401);
    }
    if (!forceRefresh && current.accessTokenExpiresAt - this.now() > REFRESH_WINDOW) return current.session;
    if (this.refreshFlight) return this.refreshFlight;
    const revision = this.revision;
    const flight = (async () => {
      try {
        const response = await this.fetcher(`${API_ORIGIN}/api/auth/mobile/refresh`, {
          method: 'POST', headers: { Authorization: `Bearer ${current.session}` },
        });
        const next = parseSession(await readJson(response));
        if (revision !== this.revision) throw new ApiError('Tài khoản đã thay đổi.', 401);
        if (next.user.id !== current.user.id || next.expiresAt > current.expiresAt + 1000 || next.accessTokenExpiresAt <= this.now()) {
          throw new ApiError('Phản hồi làm mới phiên không hợp lệ. Vui lòng đăng nhập lại.', 401);
        }
        await this.persist(next);
        if (revision !== this.revision) throw new ApiError('Tài khoản đã thay đổi.', 401);
        this.current = next;
        this.emit();
        return next.session;
      } catch (error) {
        if (revision === this.revision && error instanceof ApiError && (error.status === 401 || error.status === 403)) await this.clear();
        throw error;
      }
    })();
    this.refreshFlight = flight;
    try { return await flight; } finally { if (this.refreshFlight === flight) this.refreshFlight = null; }
  }
  fetch: Fetcher = async (input, init) => {
    const account = this.current?.user.id;
    const authorization = await this.authorization();
    if (!account || account !== this.current?.user.id) throw new ApiError('Tài khoản đã thay đổi.', 401);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${authorization}`);
    let response = await this.fetcher(input, { ...init, headers });
    if (response.status === 401) {
      // Avoid response.clone() which throws "Not implemented" in expo/fetch (FetchResponse.ts:125).
      // Consume the error body directly; error responses do not need to be read again by the caller.
      let data: unknown = null;
      try { data = await response.json(); } catch { data = null; }
      if (data && typeof data === 'object' && 'code' in data && data.code === 'SESSION_REFRESH_REQUIRED') {
        // Server guarantees SESSION_REFRESH_REQUIRED is emitted before chat/calendar side effects.
        headers.set('Authorization', `Bearer ${await this.authorization(true)}`);
        if (account !== this.current?.user.id) throw new ApiError('Tài khoản đã thay đổi.', 401);
        response = await this.fetcher(input, { ...init, headers });
      } else {
        if (account === this.current?.user.id) await this.clear();
        const errorBody = JSON.stringify(data || { error: 'Unauthorized' });
        return new Response(errorBody, {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 401 && account === this.current?.user.id) {
        await this.clear();
        return response;
      }
    }
    if (this.current !== null && account !== this.current.user.id) {
      await response.body?.cancel();
      throw new ApiError('Phiên đã hết hạn hoặc tài khoản đã thay đổi. Vui lòng đăng nhập lại.', 401);
    }
    return response;
  };
}

export const authClient = new AuthClient();

export function configureGoogle(): void {
  if (!GOOGLE_WEB_CLIENT_ID.endsWith('.apps.googleusercontent.com')) throw new Error('Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Cần cấu hình OAuth Web client ID và build lại ứng dụng.');
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID.endsWith('.apps.googleusercontent.com')) throw new Error('Thiếu EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID và URL scheme iOS. Vui lòng cấu hình rồi build lại.');
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    scopes: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'],
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
}

export async function signInGoogle(): Promise<boolean> {
  configureGoogle();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return false;
    const code = result.data.serverAuthCode;
    if (!code) throw new Error('Google chưa cấp mã truy cập ngoại tuyến. Kiểm tra Web client ID, quyền Calendar và đăng nhập lại.');
    await authClient.exchange(code);
    return true;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return false;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Thiết bị cần Google Play Services để đăng nhập.');
      throw new Error('Không thể đăng nhập Google. Kiểm tra OAuth client ID, SHA-1 và quyền Calendar rồi thử lại.');
    }
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && (error.message.startsWith('Google chưa') || error.message.startsWith('Máy chủ trả'))) throw error;
    throw new Error('Không thể hoàn tất đăng nhập. Kiểm tra mạng và cấu hình Google rồi thử lại.');
  }
}

export async function signOutGoogle(): Promise<void> {
  let storageFailed = false;
  try { await authClient.clear(); } catch { storageFailed = true; }
  try { if (GOOGLE_WEB_CLIENT_ID) { configureGoogle(); await GoogleSignin.signOut(); } }
  catch { throw new Error('Phiên ứng dụng đã đóng nhưng chưa đăng xuất được Google SDK. Vui lòng thử lại.'); }
  if (storageFailed) throw new Error('Chưa xóa được phiên trên thiết bị. Vui lòng thử đăng xuất lại.');
}
