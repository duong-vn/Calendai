export const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;
export const ANONYMOUS_CHAT_RATE_LIMIT = 10;
export const AUTHENTICATED_CHAT_RATE_LIMIT = 30;
export const MAX_TRACKED_IPS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

// ponytail: in-process sliding-window map per instance — upgrade to shared store (e.g. Redis) if distributed enforcement is needed.
const ipRequests = new Map<string, number[]>();

/**
 * Extracts and normalizes the client IP address from common proxy headers.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first.toLowerCase().slice(0, 128);
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.toLowerCase().slice(0, 128);
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp.toLowerCase().slice(0, 128);
  return 'unknown';
}

function pruneTrackedIps(cutoff: number): void {
  for (const [trackedIp, timestamps] of ipRequests.entries()) {
    const active = timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) {
      ipRequests.delete(trackedIp);
    } else {
      ipRequests.set(trackedIp, active);
    }
  }
  if (ipRequests.size >= MAX_TRACKED_IPS) {
    const oldestIp = ipRequests.keys().next().value;
    if (oldestIp !== undefined) {
      ipRequests.delete(oldestIp);
    }
  }
}

/**
 * Checks and records a sliding-window per-IP request for POST /api/chat.
 */
export function checkChatRateLimit(
  req: Request,
  isAuthenticated: boolean,
  now = Date.now()
): RateLimitResult {
  const ip = getClientIp(req);
  const limit = isAuthenticated ? AUTHENTICATED_CHAT_RATE_LIMIT : ANONYMOUS_CHAT_RATE_LIMIT;
  const cutoff = now - CHAT_RATE_LIMIT_WINDOW_MS;
  const existing = ipRequests.get(ip) ?? [];
  const activeTimestamps = existing.filter((ts) => ts > cutoff);

  if (activeTimestamps.length >= limit) {
    const oldestRelevant =
      activeTimestamps[activeTimestamps.length - limit] ?? activeTimestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestRelevant + CHAT_RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    ipRequests.set(ip, activeTimestamps);
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  if (!ipRequests.has(ip) && ipRequests.size >= MAX_TRACKED_IPS) {
    pruneTrackedIps(cutoff);
  }

  activeTimestamps.push(now);
  ipRequests.set(ip, activeTimestamps);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - activeTimestamps.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Clears in-memory rate-limit state for deterministic testing.
 */
export function resetChatRateLimit(): void {
  ipRequests.clear();
}
