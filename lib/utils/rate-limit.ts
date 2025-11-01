/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based solutions like Vercel KV or Upstash
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  interval: number // Time window in milliseconds
  limit: number // Max requests per interval
}

export const rateLimitConfigs = {
  auth: { interval: 15 * 60 * 1000, limit: 5 }, // 5 requests per 15 minutes
  upload: { interval: 60 * 60 * 1000, limit: 10 }, // 10 requests per hour
  api: { interval: 60 * 1000, limit: 100 }, // 100 requests per minute
} as const

/**
 * Check if a request should be rate limited
 * @param identifier Unique identifier (e.g., IP address, user ID)
 * @param config Rate limit configuration
 * @returns Object with success flag and rate limit info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): {
  success: boolean
  limit: number
  remaining: number
  reset: number
} {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to trigger cleanup
    cleanupExpiredEntries()
  }

  if (!entry || now > entry.resetTime) {
    // First request or reset time passed
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.interval,
    })

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: now + config.interval,
    }
  }

  if (entry.count < config.limit) {
    // Within limit
    entry.count++
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - entry.count,
      reset: entry.resetTime,
    }
  }

  // Rate limit exceeded
  return {
    success: false,
    limit: config.limit,
    remaining: 0,
    reset: entry.resetTime,
  }
}

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Get client identifier from request
 * Priority: User ID > IP Address
 */
export function getClientIdentifier(req: Request): string {
  // Try to get IP from headers (works with proxies/load balancers)
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')

  const ip = forwardedFor?.split(',')[0] ?? realIp ?? 'unknown'

  return ip
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(rateLimitInfo: {
  limit: number
  remaining: number
  reset: number
}) {
  return {
    'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
    'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimitInfo.reset).toISOString(),
  }
}
