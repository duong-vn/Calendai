import { AuthClient } from './auth';
import { ApiError, API_ORIGIN } from './transport';
import type { MobileSession } from '../types';

jest.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: {}, isErrorWithCode: () => false, statusCodes: {} }));

const NOW = 1_800_000_000_000;
const session = (overrides: Partial<MobileSession> = {}): MobileSession => ({
  session: 'encrypted-session-not-a-real-value', user: { id: 'account-a', email: 'a@example.com' },
  expiresAt: NOW + 86_400_000, accessTokenExpiresAt: NOW + 3_600_000, ...overrides,
});
const response = (value: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300, status, json: async () => value,
  clone: () => { throw new Error('Not implemented'); }, body: null,
} as unknown as Response);
function setup(value: MobileSession | null = null) {
  let stored = value ? JSON.stringify({ origin: API_ORIGIN, ...value }) : null;
  const store = {
    getItemAsync: jest.fn(async () => stored),
    setItemAsync: jest.fn(async (_key: string, next: string) => { stored = next; }),
    deleteItemAsync: jest.fn(async () => { stored = null; }),
  };
  const fetcher = jest.fn();
  const client = new AuthClient(store, fetcher, () => NOW);
  return { client, store, fetcher, stored: () => stored };
}

describe('native session lifecycle', () => {
  it('restores a server session only from SecureStore and clears it on logout', async () => {
    const { client, store } = setup(session());
    await client.restore();
    expect(client.getSnapshot()?.user.id).toBe('account-a');
    expect(await client.authorization()).toBe(session().session);
    await client.clear();
    expect(client.getSnapshot()).toBeNull();
    expect(store.deleteItemAsync).toHaveBeenCalledTimes(1);
  });
  it('exchanges only the server auth code, not a client profile', async () => {
    const { client, fetcher, store } = setup();
    fetcher.mockResolvedValue(response(session()));
    await client.exchange('one-use-code');
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe(`${API_ORIGIN}/api/auth/mobile/exchange`);
    expect(JSON.parse(request.body)).toEqual({ code: 'one-use-code' });
    expect(store.setItemAsync).toHaveBeenCalled();
  });
  it('refreshes once before Google expiry for concurrent API requests', async () => {
    const { client, fetcher } = setup(session({ accessTokenExpiresAt: NOW + 5_000 }));
    await client.restore();
    fetcher.mockResolvedValue(response(session({ session: 'encrypted-new-session-not-real' })));
    const result = await Promise.all([client.authorization(), client.authorization(), client.authorization()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual(Array(3).fill('encrypted-new-session-not-real'));
    expect(client.getSnapshot()?.expiresAt).toBe(session().expiresAt);
  });
  it('does not resurrect a session after logout during refresh', async () => {
    const { client, fetcher, stored } = setup(session({ accessTokenExpiresAt: NOW + 10 }));
    await client.restore();
    let resolve!: (value: Response) => void;
    fetcher.mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = client.authorization();
    await client.clear();
    resolve(response(session()));
    await expect(pending).rejects.toBeInstanceOf(ApiError);
    expect(client.getSnapshot()).toBeNull();
    expect(stored()).toBeNull();
  });
  it('keeps the existing session on network failure so a retry is possible', async () => {
    const { client, fetcher, store } = setup(session({ accessTokenExpiresAt: NOW + 10 }));
    await client.restore();
    fetcher.mockRejectedValue(new Error('offline'));
    await expect(client.authorization()).rejects.toThrow('offline');
    expect(client.getSnapshot()).not.toBeNull();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });
  it('clears revoked refresh sessions and does not leak server error details', async () => {
    const { client, fetcher } = setup(session({ accessTokenExpiresAt: NOW + 10 }));
    await client.restore();
    fetcher.mockResolvedValue(response({ error: 'private provider payload' }, 401));
    await expect(client.authorization()).rejects.not.toThrow('private provider payload');
    expect(client.getSnapshot()).toBeNull();
  });
  it('rejects refresh responses for a different account', async () => {
    const { client, fetcher } = setup(session({ accessTokenExpiresAt: NOW + 10 }));
    await client.restore();
    fetcher.mockResolvedValue(response(session({ user: { id: 'account-b', email: 'b@example.com' } })));
    await expect(client.authorization()).rejects.toBeInstanceOf(ApiError);
    expect(client.getSnapshot()).toBeNull();
  });
  it('retries only explicit pre-side-effect refresh-required, not arbitrary failures', async () => {
    const { client, fetcher } = setup(session());
    await client.restore();
    fetcher.mockResolvedValueOnce(response({ code: 'SESSION_REFRESH_REQUIRED' }, 401))
      .mockResolvedValueOnce(response(session()))
      .mockResolvedValueOnce(response({ success: true }));
    await client.fetch(`${API_ORIGIN}/api/calendar/confirm`, { method: 'POST', body: '{}' });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toContain('/api/auth/mobile/refresh');
  });
});
