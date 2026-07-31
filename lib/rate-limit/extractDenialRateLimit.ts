/**
 * Rate limiting for the public /api/extract-denial endpoint.
 * In-memory sliding window — no external dependency.
 */

const HOUR_MS = 60 * 60 * 1000;

class SlidingWindowLimiter {
  private requests = new Map<string, number[]>();
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const valid = (this.requests.get(key) ?? []).filter(
      (t) => now - t < this.windowMs
    );
    if (valid.length >= this.maxRequests) {
      this.requests.set(key, valid);
      return { allowed: false, remaining: 0 };
    }
    valid.push(now);
    this.requests.set(key, valid);
    return {
      allowed: true,
      remaining: this.maxRequests - valid.length,
    };
  }
}

const unauthenticatedLimiter = new SlidingWindowLimiter(3, HOUR_MS);
const authenticatedLimiter = new SlidingWindowLimiter(20, HOUR_MS);

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function checkExtractDenialRateLimit(args: {
  ip: string;
  authenticated: boolean;
}): { allowed: boolean; remaining: number } {
  const limiter = args.authenticated
    ? authenticatedLimiter
    : unauthenticatedLimiter;
  const key = `${args.authenticated ? "auth" : "anon"}:${args.ip}`;
  return limiter.check(key);
}

export const EXTRACT_DENIAL_RATE_LIMIT_MESSAGE =
  "Too many requests. Please try again later.";
