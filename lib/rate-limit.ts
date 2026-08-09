export function rateLimit(limit: number, windowMs: number) {
  const ipMap = new Map<string, { count: number; expiresAt: number }>();

  return function (ip: string): boolean {
    const now = Date.now();
    const record = ipMap.get(ip);

    if (record) {
      if (now > record.expiresAt) {
        // Window expired, reset
        ipMap.set(ip, { count: 1, expiresAt: now + windowMs });
        return true;
      }
      if (record.count >= limit) {
        return false; // Rate limit exceeded
      }
      // Increment
      record.count++;
      return true;
    }

    // New IP
    ipMap.set(ip, { count: 1, expiresAt: now + windowMs });
    return true;
  };
}

export const apiRateLimiter = rateLimit(30, 60 * 1000); // 30 requests per minute
