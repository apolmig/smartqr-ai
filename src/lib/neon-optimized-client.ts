// Neon-Optimized Prisma Client for Serverless Functions
// Solves read-after-write consistency issues in Neon PostgreSQL

import { PrismaClient } from '@prisma/client';

// Configuration optimized for Neon PostgreSQL serverless
const NEON_CONFIG = {
  // Write operations need longer timeouts for consistency
  writeTimeout: 10000,
  readTimeout: 5000,
  
  // Connection pool settings optimized for Netlify Functions
  connectionLimit: 3, // Reduced for serverless
  poolTimeout: 20,
  
  // Retry configuration for eventual consistency
  maxRetries: 5,
  retryDelay: 200,
  
  // Consistency verification settings
  consistencyCheckDelay: 100,
  maxConsistencyChecks: 3
};

// Build optimized connection string for different operation types
function buildNeonConnectionString(operationType: 'read' | 'write' = 'read'): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const url = new URL(baseUrl);
  const params = new URLSearchParams(url.search);
  
  // Base Neon optimizations
  params.set('sslmode', 'require');
  params.set('application_name', `smartqr-${operationType}-${process.env.NODE_ENV || 'dev'}`);
  
  if (operationType === 'write') {
    // Write operations: prefer primary connection
    params.set('pgbouncer', 'false'); // Direct connection for writes
    params.set('connect_timeout', '10');
    params.set('statement_timeout', '10000');
    params.set('idle_in_transaction_session_timeout', '10000');
  } else {
    // Read operations: can use pooling
    params.set('pgbouncer', 'true');
    params.set('connection_limit', NEON_CONFIG.connectionLimit.toString());
    params.set('pool_timeout', NEON_CONFIG.poolTimeout.toString());
  }
  
  url.search = params.toString();
  return url.toString();
}

// Write-optimized Prisma client
export const writeClient = new PrismaClient({
  datasources: {
    db: {
      url: buildNeonConnectionString('write'),
    },
  },
  log: [
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'query', emit: 'event' },
  ],
  transactionOptions: {
    timeout: NEON_CONFIG.writeTimeout,
    isolationLevel: 'ReadCommitted', // Ensures consistency
  },
});

// Read-optimized Prisma client
export const readClient = new PrismaClient({
  datasources: {
    db: {
      url: buildNeonConnectionString('read'),
    },
  },
  log: [
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
  transactionOptions: {
    timeout: NEON_CONFIG.readTimeout,
    isolationLevel: 'ReadCommitted',
  },
});

// Performance monitoring
let queryCount = 0;
let slowQueryCount = 0;

writeClient.$on('query', (e) => {
  queryCount++;
  if (e.duration > 1000) {
    slowQueryCount++;
    console.warn(`🐌 Slow WRITE query (${e.duration}ms):`, {
      query: e.query.substring(0, 100),
      duration: e.duration,
    });
  }
});

// Utility function to retry operations with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string = '',
  maxRetries: number = NEON_CONFIG.maxRetries
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.code === 'P2002' || error.code === 'P2025') {
        throw error;
      }
      
      if (attempt === maxRetries) {
        console.error(`❌ Max retries (${maxRetries}) exceeded for ${context}:`, error.message);
        break;
      }
      
      const delay = NEON_CONFIG.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.warn(`⚠️  Retry ${attempt}/${maxRetries} for ${context} (waiting ${delay}ms):`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Enhanced consistency check function
export async function verifyConsistency<T>(
  writeResult: T,
  verificationQuery: () => Promise<T | null>,
  context: string = 'operation'
): Promise<T> {
  const writeResultId = (writeResult as any)?.id || (writeResult as any)?.shortId;
  
  if (!writeResultId) {
    console.warn(`⚠️  Cannot verify consistency for ${context}: no ID found`);
    return writeResult;
  }
  
  console.log(`🔍 Verifying consistency for ${context} (ID: ${writeResultId})`);
  
  for (let attempt = 1; attempt <= NEON_CONFIG.maxConsistencyChecks; attempt++) {
    try {
      // Wait for potential eventual consistency
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, NEON_CONFIG.consistencyCheckDelay * attempt));
      }
      
      const verified = await withRetry(verificationQuery, `consistency-check-${attempt}`);
      
      if (verified) {
        console.log(`✅ Consistency verified for ${context} on attempt ${attempt}`);
        return writeResult;
      }
      
      console.warn(`⚠️  Consistency check ${attempt}/${NEON_CONFIG.maxConsistencyChecks} failed for ${context}`);
    } catch (error: any) {
      console.error(`❌ Consistency verification error for ${context}:`, error.message);
    }
  }
  
  console.error(`❌ Consistency verification failed for ${context} after ${NEON_CONFIG.maxConsistencyChecks} attempts`);
  return writeResult; // Return original result even if verification fails
}

// Health check function
export async function checkNeonHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  details: Record<string, any>;
}> {
  const startTime = Date.now();
  
  try {
    // Test write client
    const writeTest = await writeClient.$queryRaw`SELECT 1 as write_test`;
    const writeLatency = Date.now() - startTime;
    
    // Test read client
    const readStart = Date.now();
    const readTest = await readClient.$queryRaw`SELECT 1 as read_test`;
    const readLatency = Date.now() - readStart;
    
    const status = writeLatency < 2000 && readLatency < 1000 ? 'healthy' : 'degraded';
    
    return {
      status,
      details: {
        writeLatency,
        readLatency,
        totalQueries: queryCount,
        slowQueries: slowQueryCount,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      status: 'down',
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Export for compatibility
export default writeClient;