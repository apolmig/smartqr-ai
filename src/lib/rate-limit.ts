interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limiting (for production, use Redis or database)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests, please try again later',
      ...config,
    };
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; error?: string; remaining?: number }> {
    const now = Date.now();
    const key = identifier;
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup on each request
      this.cleanup();
    }

    const entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      // No entry or window has expired, create new entry
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      
      return { 
        allowed: true, 
        remaining: this.config.maxRequests - 1 
      };
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return { 
        allowed: false, 
        error: this.config.message,
        remaining: 0
      };
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);
    
    return { 
      allowed: true, 
      remaining: this.config.maxRequests - entry.count 
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
}

// Predefined rate limiters for different use cases
export const authRateLimiter = new RateLimiter({
  maxRequests: 5, // 5 attempts
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

export const generalRateLimiter = new RateLimiter({
  maxRequests: 100, // 100 requests
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests. Please try again later.',
});

// Helper function to get client IP
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const connectionIP = request.headers.get('x-vercel-forwarded-for');
  
  return (
    forwarded?.split(',')[0]?.trim() ||
    realIP ||
    connectionIP ||
    'unknown'
  );
}