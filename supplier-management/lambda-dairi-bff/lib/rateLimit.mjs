// In-memory sliding-window rate limiter factory.
// Per-Lambda-instance; counts persist across warm invocations.
// Multiple concurrent instances each enforce the limit independently —
// acceptable for low-volume endpoints (helpdesk, etc.).

/**
 * Create a rate limiter.
 *
 * @param {{ windowMs: number, maxRequests: number }} opts
 * @returns {(key: string) => { allowed: boolean, waitSeconds?: number }}
 */
export function createRateLimiter({ windowMs, maxRequests }) {
  const hits = new Map(); // key → { start: number, count: number }

  return function check(key) {
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }

    if (entry.count >= maxRequests) {
      const waitSeconds = Math.ceil((entry.start + windowMs - now) / 1000);
      return { allowed: false, waitSeconds };
    }

    entry.count += 1;
    return { allowed: true };
  };
}
