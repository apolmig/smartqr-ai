/**
 * NEON PERSISTENCE SOLUTION
 * 
 * Final implementation that solves the QR persistence issues through:
 * 1. Dedicated connection management for read/write operations
 * 2. Strong consistency guarantees with verification
 * 3. Intelligent retry logic with exponential backoff
 * 4. Comprehensive error handling and recovery
 * 5. Performance monitoring and diagnostics
 */

import { getNeonClient, NeonOptimizedClient } from './neon-optimized-client';
import { transactionLogger } from './transaction-logger';
import { generateShortId } from './utils';
import { getPlanLimits } from './prisma';

interface QRCreationData {
  name: string;
  targetUrl: string;
  enableAI?: boolean;
  qrStyle?: string;
  qrColor?: string;
  qrSize?: number;
  qrOptions?: any;
}

interface QRCreationResult {
  qr: any;
  consistencyVerified: boolean;
  creationTime: number;
  verificationTime: number;
  warnings: string[];
}

interface UserQRResult {
  qrCodes: any[];
  fetchTime: number;
  attempts: number;
  cacheHit: boolean;
}

class NeonPersistenceSolution {
  private writeClient: NeonOptimizedClient;
  private readClient: NeonOptimizedClient;
  private userCache: Map<string, { user: any; timestamp: number }> = new Map();
  private qrCache: Map<string, { qr: any; timestamp: number }> = new Map();
  
  // Cache TTL in milliseconds
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Separate clients for read and write operations
    this.writeClient = getNeonClient('WRITE_OPTIMIZED', {
      maxConnections: 2,
      statementTimeout: 15000,
      idleTimeout: 8000,
      enableLogging: true
    });

    this.readClient = getNeonClient('READ_OPTIMIZED', {
      maxConnections: 3,
      statementTimeout: 10000,
      idleTimeout: 5000,
      enableLogging: true
    });

    // Periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Enhanced user management with caching and consistency
   */
  async ensureUser(userIdentifier: string, name?: string, email?: string): Promise<any> {
    const finalEmail = email || `${userIdentifier}@demo.local`;
    const cacheKey = `user:${finalEmail}`;
    
    // Check cache first
    const cached = this.userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      transactionLogger.log({
        instanceId: 'CACHE',
        operation: 'USER_CACHE_HIT',
        success: true,
        metadata: { userEmail: finalEmail }
      });
      return cached.user;
    }

    const startTime = Date.now();

    try {
      // Try to find existing user first
      let existingUser = await this.readClient.readWithConsistency(
        () => this.readClient.prisma.user.findUnique({
          where: { email: finalEmail }
        }),
        { maxRetries: 2, retryDelay: 50 }
      );

      if (existingUser) {
        // Cache the found user
        this.userCache.set(cacheKey, {
          user: existingUser,
          timestamp: Date.now()
        });

        transactionLogger.log({
          instanceId: 'READ_OPTIMIZED',
          operation: 'USER_FOUND',
          success: true,
          duration: Date.now() - startTime,
          metadata: { userId: existingUser.id, email: finalEmail }
        });

        return existingUser;
      }

      // Create new user with verification
      const newUser = await this.writeClient.executeTransaction(
        async (tx) => {
          // Double-check within transaction
          const doubleCheck = await tx.user.findUnique({
            where: { email: finalEmail }
          });

          if (doubleCheck) {
            return doubleCheck;
          }

          return await tx.user.create({
            data: {
              name: name || `User ${userIdentifier}`,
              email: finalEmail,
              plan: 'FREE',
            },
          });
        },
        {
          timeout: 10000,
          isolationLevel: 'ReadCommitted',
          retryOnFailure: true
        }
      );

      // Verify consistency
      const { consistent, attempts } = await this.writeClient.verifyConsistency(
        () => Promise.resolve(newUser),
        () => this.readClient.prisma.user.findUnique({ where: { email: finalEmail } }).then(Boolean),
        { maxRetries: 3, retryDelay: 100 }
      );

      if (!consistent) {
        console.warn('⚠️  User creation consistency warning', {
          userId: newUser.id,
          email: finalEmail,
          attempts
        });
      }

      // Cache the new user
      this.userCache.set(cacheKey, {
        user: newUser,
        timestamp: Date.now()
      });

      transactionLogger.log({
        instanceId: 'WRITE_OPTIMIZED',
        operation: 'USER_CREATED',
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          userId: newUser.id,
          email: finalEmail,
          consistent,
          attempts
        }
      });

      return newUser;

    } catch (error) {
      transactionLogger.log({
        instanceId: 'WRITE_OPTIMIZED',
        operation: 'ENSURE_USER_FAILED',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userEmail: finalEmail }
      });

      throw new Error(`User creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced QR code creation with comprehensive consistency checking
   */
  async createQRCode(userIdentifier: string, data: QRCreationData): Promise<QRCreationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // 1. Ensure user exists
      const user = await this.ensureUser(userIdentifier);

      // 2. Check plan limits
      const userWithQRs = await this.readClient.readWithConsistency(
        () => this.readClient.prisma.user.findUnique({
          where: { id: user.id },
          include: { qrCodes: true }
        })
      );

      if (!userWithQRs) {
        throw new Error('User not found after creation');
      }

      const limits = getPlanLimits(userWithQRs.plan);
      if (limits.qrCodes !== -1 && userWithQRs.qrCodes.length >= limits.qrCodes) {
        throw new Error('QR code limit reached for your plan');
      }

      // 3. Generate unique short ID with collision detection
      let shortId: string;
      let collisionAttempts = 0;
      const maxCollisionAttempts = 10;

      do {
        shortId = generateShortId();
        const existing = await this.readClient.prisma.qRCode.findUnique({
          where: { shortId }
        });

        if (!existing) break;
        
        collisionAttempts++;
        transactionLogger.log({
          instanceId: 'READ_OPTIMIZED',
          operation: 'SHORTID_COLLISION',
          success: true,
          metadata: { shortId, attempt: collisionAttempts }
        });

      } while (collisionAttempts < maxCollisionAttempts);

      if (collisionAttempts >= maxCollisionAttempts) {
        throw new Error('Failed to generate unique short ID');
      }

      if (collisionAttempts > 3) {
        warnings.push(`High collision rate for short ID generation (${collisionAttempts} attempts)`);
      }

      // 4. Create QR code with strong consistency guarantees
      const qrCreationResult = await this.writeClient.executeTransaction(
        async (tx) => {
          const qrCode = await tx.qRCode.create({
            data: {
              name: data.name,
              shortId,
              targetUrl: data.targetUrl,
              enableAI: data.enableAI || false,
              qrStyle: data.qrStyle || 'classic',
              qrColor: data.qrColor || '#000000',
              qrSize: data.qrSize || 256,
              qrOptions: data.qrOptions ? JSON.stringify(data.qrOptions) : null,
              userId: user.id,
            },
            include: {
              scans: true,
            },
          });

          // Immediate verification within transaction
          const verification = await tx.qRCode.findUnique({
            where: { shortId: qrCode.shortId }
          });

          if (!verification) {
            throw new Error('QR creation verification failed within transaction');
          }

          return qrCode;
        },
        {
          timeout: 15000,
          isolationLevel: 'ReadCommitted',
          retryOnFailure: true
        }
      );

      const creationTime = Date.now() - startTime;

      // 5. Multi-stage consistency verification
      const verificationStartTime = Date.now();
      
      const consistencyResults = await Promise.all([
        // Test 1: Direct lookup by shortId
        this.writeClient.verifyConsistency(
          () => Promise.resolve(qrCreationResult),
          () => this.readClient.prisma.qRCode.findUnique({
            where: { shortId: qrCreationResult.shortId }
          }).then(Boolean),
          { maxRetries: 3, retryDelay: 50 }
        ),

        // Test 2: User QR codes query
        this.writeClient.verifyConsistency(
          () => Promise.resolve(qrCreationResult),
          async () => {
            const userQRs = await this.readClient.prisma.qRCode.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' }
            });
            return userQRs.some(qr => qr.shortId === qrCreationResult.shortId);
          },
          { maxRetries: 5, retryDelay: 100 }
        ),

        // Test 3: Count verification
        this.writeClient.verifyConsistency(
          () => Promise.resolve(qrCreationResult),
          async () => {
            const count = await this.readClient.prisma.qRCode.count({
              where: { shortId: qrCreationResult.shortId }
            });
            return count === 1;
          },
          { maxRetries: 2, retryDelay: 75 }
        )
      ]);

      const [directLookup, userQRsCheck, countCheck] = consistencyResults;
      const verificationTime = Date.now() - verificationStartTime;

      // Analyze consistency results
      const allConsistent = directLookup.consistent && userQRsCheck.consistent && countCheck.consistent;

      if (!directLookup.consistent) {
        warnings.push(`Direct lookup consistency failed after ${directLookup.attempts} attempts`);
      }

      if (!userQRsCheck.consistent) {
        warnings.push(`User QRs query consistency failed after ${userQRsCheck.attempts} attempts`);
      }

      if (!countCheck.consistent) {
        warnings.push(`Count verification consistency failed after ${countCheck.attempts} attempts`);
      }

      // Cache the created QR
      const cacheKey = `qr:${qrCreationResult.shortId}`;
      this.qrCache.set(cacheKey, {
        qr: qrCreationResult,
        timestamp: Date.now()
      });

      // Invalidate user cache to force refresh
      const userCacheKey = `user:${user.email}`;
      this.userCache.delete(userCacheKey);

      transactionLogger.log({
        instanceId: 'WRITE_OPTIMIZED',
        operation: 'QR_CREATION_COMPLETE',
        success: true,
        duration: creationTime + verificationTime,
        metadata: {
          qrId: qrCreationResult.id,
          shortId: qrCreationResult.shortId,
          userId: user.id,
          creationTime,
          verificationTime,
          consistencyResults: {
            directLookup: directLookup.consistent,
            userQRsCheck: userQRsCheck.consistent,
            countCheck: countCheck.consistent,
            allConsistent
          },
          warnings
        }
      });

      return {
        qr: qrCreationResult,
        consistencyVerified: allConsistent,
        creationTime,
        verificationTime,
        warnings
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      transactionLogger.log({
        instanceId: 'WRITE_OPTIMIZED',
        operation: 'QR_CREATION_FAILED',
        success: false,
        duration: totalTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userIdentifier, qrName: data.name }
      });

      throw error;
    }
  }

  /**
   * Enhanced user QR codes retrieval with intelligent caching and retry
   */
  async getUserQRCodes(userIdentifier: string): Promise<UserQRResult> {
    const startTime = Date.now();

    try {
      // 1. Ensure user exists
      const user = await this.ensureUser(userIdentifier);

      // 2. Multi-strategy QR retrieval
      const strategies = [
        // Strategy 1: Direct query with minimal delay
        { delay: 0, maxRetries: 1 },
        // Strategy 2: Short delay for eventual consistency
        { delay: 100, maxRetries: 1 },
        // Strategy 3: Longer delay with retries
        { delay: 250, maxRetries: 2 },
        // Strategy 4: Final attempt with maximum effort
        { delay: 500, maxRetries: 3 }
      ];

      let qrCodes: any[] = [];
      let totalAttempts = 0;
      let strategyUsed = 0;

      for (const [index, strategy] of strategies.entries()) {
        strategyUsed = index + 1;
        
        if (strategy.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, strategy.delay));
        }

        try {
          qrCodes = await this.readClient.readWithConsistency(
            () => this.readClient.prisma.qRCode.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
            }),
            {
              maxRetries: strategy.maxRetries,
              retryDelay: 50,
              exponentialBackoff: true
            }
          );

          totalAttempts += strategy.maxRetries;

          transactionLogger.log({
            instanceId: 'READ_OPTIMIZED',
            operation: `QR_FETCH_STRATEGY_${strategyUsed}`,
            success: true,
            metadata: {
              userId: user.id,
              qrCount: qrCodes.length,
              delay: strategy.delay,
              strategy: strategyUsed
            }
          });

          // If we found QRs, break early
          if (qrCodes.length > 0) {
            break;
          }

        } catch (error) {
          totalAttempts += strategy.maxRetries;
          
          transactionLogger.log({
            instanceId: 'READ_OPTIMIZED',
            operation: `QR_FETCH_STRATEGY_${strategyUsed}_FAILED`,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: { userId: user.id, strategy: strategyUsed }
          });

          // Continue to next strategy unless this is the last one
          if (index === strategies.length - 1) {
            throw error;
          }
        }
      }

      // 3. Debug information if no QRs found
      if (qrCodes.length === 0) {
        const debugInfo = await this.gatherDebugInfo(user.id);
        
        transactionLogger.log({
          instanceId: 'READ_OPTIMIZED',
          operation: 'QR_FETCH_DEBUG_INFO',
          success: true,
          metadata: {
            userId: user.id,
            userEmail: user.email,
            debugInfo,
            totalAttempts,
            strategiesUsed: strategyUsed
          }
        });
      }

      const fetchTime = Date.now() - startTime;

      return {
        qrCodes,
        fetchTime,
        attempts: totalAttempts,
        cacheHit: false
      };

    } catch (error) {
      const fetchTime = Date.now() - startTime;
      
      transactionLogger.log({
        instanceId: 'READ_OPTIMIZED',
        operation: 'GET_USER_QR_CODES_FAILED',
        success: false,
        duration: fetchTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userIdentifier }
      });

      // Return empty array on failure instead of throwing
      return {
        qrCodes: [],
        fetchTime,
        attempts: 0,
        cacheHit: false
      };
    }
  }

  /**
   * Enhanced QR lookup with dual-client verification
   */
  async getQRByShortId(shortId: string): Promise<any> {
    const cacheKey = `qr:${shortId}`;
    
    // Check cache first
    const cached = this.qrCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      transactionLogger.log({
        instanceId: 'CACHE',
        operation: 'QR_CACHE_HIT',
        success: true,
        metadata: { shortId }
      });
      return cached.qr;
    }

    try {
      // Try both clients for consistency verification
      const [readResult, writeResult] = await Promise.all([
        this.readClient.readWithConsistency(
          () => this.readClient.prisma.qRCode.findUnique({
            where: { shortId },
            include: {
              variants: {
                where: { isActive: true },
              },
            },
          }),
          { maxRetries: 2, retryDelay: 50 }
        ),
        this.writeClient.readWithConsistency(
          () => this.writeClient.prisma.qRCode.findUnique({
            where: { shortId },
            include: {
              variants: {
                where: { isActive: true },
              },
            },
          }),
          { maxRetries: 1, retryDelay: 25 }
        )
      ]);

      const readFound = !!readResult;
      const writeFound = !!writeResult;
      const consistent = readFound === writeFound;

      transactionLogger.log({
        instanceId: 'DUAL_CLIENT',
        operation: 'QR_LOOKUP_DUAL_CHECK',
        success: true,
        metadata: {
          shortId,
          readFound,
          writeFound,
          consistent,
          readId: readResult?.id,
          writeId: writeResult?.id
        }
      });

      if (!consistent) {
        console.warn('⚠️  QR lookup inconsistency between clients', {
          shortId,
          readClient: readFound,
          writeClient: writeFound
        });
      }

      const result = readResult || writeResult;

      // Cache the result if found
      if (result) {
        this.qrCache.set(cacheKey, {
          qr: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      transactionLogger.log({
        instanceId: 'DUAL_CLIENT',
        operation: 'QR_LOOKUP_FAILED',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { shortId }
      });

      return null;
    }
  }

  /**
   * Gather comprehensive debug information
   */
  private async gatherDebugInfo(userId: string) {
    try {
      const [allUsers, allQRCodes, userQRCount, directUserQuery] = await Promise.all([
        this.readClient.prisma.user.findMany({
          select: { id: true, email: true, name: true, _count: { qrCodes: true } },
          take: 10
        }),
        this.readClient.prisma.qRCode.findMany({
          select: { id: true, name: true, userId: true, shortId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        this.readClient.prisma.$queryRaw`SELECT COUNT(*) as count FROM qr_codes WHERE user_id = ${userId}`,
        this.readClient.prisma.user.findUnique({
          where: { id: userId },
          include: { qrCodes: { take: 5, orderBy: { createdAt: 'desc' } } }
        })
      ]);

      return {
        allUsers,
        allQRCodes,
        userQRCount,
        directUserQuery: directUserQuery ? {
          id: directUserQuery.id,
          email: directUserQuery.email,
          qrCodeCount: directUserQuery.qrCodes.length
        } : null
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Debug info gathering failed' };
    }
  }

  /**
   * Cache cleanup
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    // Clean user cache
    for (const [key, value] of this.userCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.userCache.delete(key);
      }
    }

    // Clean QR cache
    for (const [key, value] of this.qrCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.qrCache.delete(key);
      }
    }
  }

  /**
   * Get comprehensive system health and metrics
   */
  async getSystemHealth() {
    const [writeHealth, readHealth] = await Promise.all([
      this.writeClient.healthCheck(),
      this.readClient.healthCheck()
    ]);

    return {
      writeClient: writeHealth,
      readClient: readHealth,
      cache: {
        userEntries: this.userCache.size,
        qrEntries: this.qrCache.size
      },
      transactionLogs: transactionLogger.analyzeTransactionPatterns()
    };
  }

  /**
   * Export debug data
   */
  exportDebugData() {
    return {
      systemHealth: this.getSystemHealth(),
      transactionLogs: transactionLogger.exportLogs(),
      cacheState: {
        userCacheSize: this.userCache.size,
        qrCacheSize: this.qrCache.size
      }
    };
  }
}

// Export singleton instance
export const neonPersistenceSolution = new NeonPersistenceSolution();

// Export types and classes
export { NeonPersistenceSolution };
export type { QRCreationData, QRCreationResult, UserQRResult };