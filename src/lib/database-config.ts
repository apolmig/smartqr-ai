// Enhanced Database Configuration for SmartQR AI System
// Optimized for high-performance AI workloads and real-time analytics

import { PrismaClient } from '@prisma/client';

// Database performance configuration
const DATABASE_CONFIG = {
  // Connection pooling optimized for AI workloads
  connectionLimit: process.env.NODE_ENV === 'production' ? 20 : 5,
  
  // Query timeouts
  queryTimeout: 30000, // 30 seconds for complex analytics
  transactionTimeout: 10000, // 10 seconds for transactions
  
  // Performance monitoring
  logQueries: process.env.NODE_ENV === 'development',
  logSlowQueries: true,
  slowQueryThreshold: 1000, // Log queries taking > 1 second
};

// Enhanced Prisma client with performance optimizations
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
    datasources: {
      db: {
        url: buildOptimizedConnectionString(),
      },
    },
  });

  // Performance monitoring
  if (DATABASE_CONFIG.logQueries) {
    client.$on('query', (e) => {
      if (e.duration > DATABASE_CONFIG.slowQueryThreshold) {
        console.warn(`🐌 Slow Query (${e.duration}ms):`, {
          query: e.query.substring(0, 200),
          params: e.params,
          duration: e.duration,
        });
      }
    });
  }

  return client;
};

// Build optimized connection string with Neon-specific optimizations
function buildOptimizedConnectionString(): string {
  const baseUrl = process.env.DATABASE_URL;
  
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Parse existing URL
  const url = new URL(baseUrl);
  
  // Add Neon-specific optimizations
  const params = new URLSearchParams(url.search);
  
  // Connection pooling
  params.set('pgbouncer', 'true');
  params.set('connection_limit', DATABASE_CONFIG.connectionLimit.toString());
  params.set('pool_timeout', '20');
  
  // Performance tuning
  params.set('statement_timeout', '30s');
  params.set('idle_in_transaction_session_timeout', '10s');
  
  // SSL and security
  if (process.env.NODE_ENV === 'production') {
    params.set('sslmode', 'require');
  }
  
  // Application name for monitoring
  params.set('application_name', `smartqr-${process.env.NODE_ENV || 'dev'}`);
  
  url.search = params.toString();
  return url.toString();
}

// Global Prisma instance with connection management
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  connectionStats: {
    created: Date;
    queryCount: number;
    errorCount: number;
  };
};

// Create or reuse Prisma client
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Initialize connection stats
if (!globalForPrisma.connectionStats) {
  globalForPrisma.connectionStats = {
    created: new Date(),
    queryCount: 0,
    errorCount: 0,
  };
}

// In development, store the client on global to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Database health check utility
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  connections: number;
  details: Record<string, any>;
}> {
  const startTime = Date.now();
  
  try {
    // Simple health check query
    const result = await prisma.$queryRaw`SELECT 1 as health_check`;
    const latency = Date.now() - startTime;
    
    // Get connection information
    const connections = await prisma.$queryRaw`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE state = 'active'
    ` as Array<{ active_connections: bigint }>;
    
    const activeConnections = Number(connections[0]?.active_connections || 0);
    
    return {
      status: latency < 1000 ? 'healthy' : 'degraded',
      latency,
      connections: activeConnections,
      details: {
        timestamp: new Date().toISOString(),
        connectionLimit: DATABASE_CONFIG.connectionLimit,
        queryCount: globalForPrisma.connectionStats.queryCount,
        uptime: Date.now() - globalForPrisma.connectionStats.created.getTime(),
      },
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      status: 'down',
      latency: Date.now() - startTime,
      connections: 0,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Optimized query helpers for common AI operations
export class DatabaseOptimizer {
  
  /**
   * High-performance QR redirect lookup
   */
  static async findActiveQRByShortId(shortId: string) {
    globalForPrisma.connectionStats.queryCount++;
    
    return prisma.qRCode.findFirst({
      where: {
        shortId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        targetUrl: true,
        enableAI: true,
        qrOptions: true,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            targetUrl: true,
            weight: true,
            conditions: true,
          },
        },
      },
    });
  }
  
  /**
   * Batch insert scans for high-frequency tracking
   */
  static async batchInsertScans(scans: Array<{
    qrCodeId: string;
    device?: string;
    country?: string;
    userAgent?: string;
    ipAddress?: string;
    additionalData?: string;
  }>) {
    globalForPrisma.connectionStats.queryCount++;
    
    return prisma.scan.createMany({
      data: scans.map(scan => ({
        ...scan,
        scannedAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }
  
  /**
   * Optimized analytics query with caching
   */
  static async getAnalyticsWithCache(
    qrCodeId: string,
    timeframe: '24h' | '7d' | '30d' | '90d'
  ) {
    const cacheKey = `analytics_${qrCodeId}_${timeframe}`;
    
    // Check cache first
    const cached = await prisma.analyticsCache.findUnique({
      where: { cacheKey },
    });
    
    if (cached && cached.expiresAt > new Date()) {
      // Update hit count
      prisma.analyticsCache.update({
        where: { cacheKey },
        data: { hitCount: { increment: 1 } },
      }).catch(() => {}); // Fire and forget
      
      return JSON.parse(cached.data);
    }
    
    // Calculate analytics
    const startTime = Date.now();
    const timeRange = getTimeRangeForFrame(timeframe);
    
    const analytics = await prisma.scan.groupBy({
      by: ['device', 'country', 'userSegment'],
      where: {
        qrCodeId,
        scannedAt: { gte: timeRange },
      },
      _count: { _all: true },
      _max: { scannedAt: true },
      _min: { scannedAt: true },
    });
    
    const calculationTime = Date.now() - startTime;
    
    // Cache the result
    const expiresAt = new Date(Date.now() + getCacheExpiryForTimeframe(timeframe));
    
    await prisma.analyticsCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        qrCodeId,
        dataType: 'analytics',
        timeframe,
        data: JSON.stringify(analytics),
        expiresAt,
        calculationTime,
      },
      update: {
        data: JSON.stringify(analytics),
        expiresAt,
        lastCalculated: new Date(),
        calculationTime,
      },
    });
    
    return analytics;
  }
  
  /**
   * User profile upsert for personalization
   */
  static async upsertUserProfile(fingerprint: string, updates: any) {
    return prisma.userProfile.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        ...updates,
      },
      update: {
        ...updates,
        totalVisits: { increment: 1 },
        lastVisit: new Date(),
      },
    });
  }
}

// Utility functions
function getTimeRangeForFrame(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

function getCacheExpiryForTimeframe(timeframe: string): number {
  switch (timeframe) {
    case '24h': return 5 * 60 * 1000; // 5 minutes
    case '7d': return 15 * 60 * 1000; // 15 minutes
    case '30d': return 60 * 60 * 1000; // 1 hour
    case '90d': return 4 * 60 * 60 * 1000; // 4 hours
    default: return 5 * 60 * 1000;
  }
}

// Cleanup utility for maintenance
export async function performDatabaseCleanup() {
  const results = {
    expiredCache: 0,
    oldScans: 0,
    inactiveSessions: 0,
  };
  
  try {
    // Clean expired cache entries
    const expiredCache = await prisma.analyticsCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    results.expiredCache = expiredCache.count;
    
    // Clean old scan data (keep 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const oldScans = await prisma.scan.deleteMany({
      where: {
        scannedAt: { lt: oneYearAgo },
      },
    });
    results.oldScans = oldScans.count;
    
    // Clean inactive sessions older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const inactiveSessions = await prisma.userSession.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: thirtyDaysAgo },
      },
    });
    results.inactiveSessions = inactiveSessions.count;
    
    console.log('🧹 Database cleanup completed:', results);
    return results;
  } catch (error) {
    console.error('Database cleanup failed:', error);
    throw error;
  }
}

export default prisma;