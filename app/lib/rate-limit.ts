import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

function createRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

let _strictLimiter: Ratelimit | null = null;
let _standardLimiter: Ratelimit | null = null;

export function getStrictLimiter() {
  if (!_strictLimiter) {
    _strictLimiter = new Ratelimit({
      redis: createRedis(),
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "rl:strict",
    });
  }
  return _strictLimiter;
}

export function getStandardLimiter() {
  if (!_standardLimiter) {
    _standardLimiter = new Ratelimit({
      redis: createRedis(),
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      prefix: "rl:standard",
    });
  }
  return _standardLimiter;
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkRateLimit(
  getLimiter: () => Ratelimit,
  request: NextRequest
): Promise<Response | null> {
  //skip rate limiting if Upstash is not configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const ip = getClientIp(request);
  const limiter = getLimiter();
  const { success, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    return Response.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  }

  return null;
}
