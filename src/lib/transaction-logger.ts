/**
 * ADVANCED TRANSACTION LOGGING FOR NEON PERSISTENCE DEBUGGING
 * 
 * This module provides comprehensive logging for database transactions,
 * connection lifecycle, and consistency verification specifically for
 * Neon PostgreSQL serverless architecture.
 */

import { PrismaClient } from '@prisma/client';

export interface TransactionLogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  instanceId: string;
  connectionId?: string;
  transactionId?: string;
  query?: string;
  params?: any;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ConnectionMetrics {
  instanceId: string;
  connectionCount: number;
  activeQueries: number;
  poolStatus: 'healthy' | 'degraded' | 'exhausted';
  backendPid?: number;
  connectionString?: string;
  lastActivity: Date;
}

class TransactionLogger {
  private logs: TransactionLogEntry[] = [];
  private connections: Map<string, ConnectionMetrics> = new Map();
  private isEnabled: boolean;

  constructor(enabled: boolean = process.env.NODE_ENV === 'development') {
    this.isEnabled = enabled;
  }

  /**
   * Generate unique operation ID for tracking
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log a transaction operation
   */
  log(entry: Omit<TransactionLogEntry, 'id' | 'timestamp'>): string {
    if (!this.isEnabled) return '';

    const logEntry: TransactionLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry
    };

    this.logs.push(logEntry);

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      const status = logEntry.success ? '✅' : '❌';
      const duration = logEntry.duration ? ` (${logEntry.duration}ms)` : '';
      console.log(`[TX-LOG] ${status} [${logEntry.instanceId}] ${logEntry.operation}${duration}`);
      
      if (logEntry.error) {
        console.error(`[TX-ERROR] ${logEntry.error}`);
      }
    }

    // Keep only last 1000 entries to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    return logEntry.id;
  }

  /**
   * Start logging for a specific operation
   */
  startOperation(instanceId: string, operation: string, metadata?: Record<string, any>): string {
    return this.log({
      instanceId,
      operation: `START: ${operation}`,
      success: true,
      metadata
    });
  }

  /**
   * End logging for a specific operation
   */
  endOperation(
    startLogId: string, 
    instanceId: string, 
    operation: string, 
    success: boolean, 
    duration?: number,
    error?: string,
    metadata?: Record<string, any>
  ): string {
    return this.log({
      instanceId,
      operation: `END: ${operation}`,
      success,
      duration,
      error,
      metadata: { ...metadata, startLogId }
    });
  }

  /**
   * Log Prisma query
   */
  logQuery(
    instanceId: string,
    query: string,
    params: any,
    duration: number,
    success: boolean,
    error?: string
  ): string {
    return this.log({
      instanceId,
      operation: 'QUERY',
      query: query.substring(0, 200), // Truncate long queries
      params,
      duration,
      success,
      error
    });
  }

  /**
   * Log connection metrics
   */
  updateConnectionMetrics(instanceId: string, metrics: Partial<ConnectionMetrics>): void {
    const existing = this.connections.get(instanceId) || {
      instanceId,
      connectionCount: 0,
      activeQueries: 0,
      poolStatus: 'healthy' as const,
      lastActivity: new Date()
    };

    const updated = {
      ...existing,
      ...metrics,
      lastActivity: new Date()
    };

    this.connections.set(instanceId, updated);

    if (this.isEnabled && process.env.NODE_ENV === 'development') {
      console.log(`[CONN-METRICS] [${instanceId}] Connections: ${updated.connectionCount}, Active: ${updated.activeQueries}, Status: ${updated.poolStatus}`);
    }
  }

  /**
   * Get recent logs for analysis
   */
  getRecentLogs(minutes: number = 5): TransactionLogEntry[] {
    if (!this.isEnabled) return [];

    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.logs.filter(log => log.timestamp >= cutoff);
  }

  /**
   * Get logs for specific operation
   */
  getOperationLogs(operation: string): TransactionLogEntry[] {
    if (!this.isEnabled) return [];

    return this.logs.filter(log => log.operation.includes(operation));
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connections.values());
  }

  /**
   * Analyze transaction patterns for issues
   */
  analyzeTransactionPatterns(): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    slowQueries: TransactionLogEntry[];
    failedOperations: TransactionLogEntry[];
    connectionIssues: string[];
    recommendations: string[];
  } {
    if (!this.isEnabled) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageDuration: 0,
        slowQueries: [],
        failedOperations: [],
        connectionIssues: [],
        recommendations: []
      };
    }

    const recentLogs = this.getRecentLogs(10); // Last 10 minutes
    const totalOps = recentLogs.length;
    const successfulOps = recentLogs.filter(log => log.success).length;
    const successRate = totalOps > 0 ? (successfulOps / totalOps) * 100 : 0;
    
    const queriesWithDuration = recentLogs.filter(log => log.duration !== undefined);
    const avgDuration = queriesWithDuration.length > 0 
      ? queriesWithDuration.reduce((sum, log) => sum + (log.duration || 0), 0) / queriesWithDuration.length
      : 0;

    const slowQueries = recentLogs.filter(log => (log.duration || 0) > 500); // > 500ms
    const failedOps = recentLogs.filter(log => !log.success);

    const connectionIssues: string[] = [];
    const recommendations: string[] = [];

    // Analyze connection patterns
    this.connections.forEach((metrics, instanceId) => {
      if (metrics.poolStatus === 'exhausted') {
        connectionIssues.push(`Connection pool exhausted for instance ${instanceId}`);
        recommendations.push('Increase connection pool size or implement connection pooling');
      }
      
      if (metrics.activeQueries > 10) {
        connectionIssues.push(`High active query count (${metrics.activeQueries}) for instance ${instanceId}`);
        recommendations.push('Review long-running queries and implement query optimization');
      }
    });

    // Analyze failure patterns
    if (successRate < 95) {
      recommendations.push('High failure rate detected - review error patterns and implement retry logic');
    }

    if (avgDuration > 200) {
      recommendations.push('High average query duration - review query performance and indexing');
    }

    if (slowQueries.length > 0) {
      recommendations.push(`${slowQueries.length} slow queries detected - optimize or add indexes`);
    }

    return {
      totalOperations: totalOps,
      successRate,
      averageDuration: Math.round(avgDuration),
      slowQueries,
      failedOperations: failedOps,
      connectionIssues,
      recommendations
    };
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): {
    timestamp: string;
    logs: TransactionLogEntry[];
    connections: ConnectionMetrics[];
    analysis: ReturnType<typeof this.analyzeTransactionPatterns>;
  } {
    return {
      timestamp: new Date().toISOString(),
      logs: this.logs,
      connections: this.getConnectionMetrics(),
      analysis: this.analyzeTransactionPatterns()
    };
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    this.connections.clear();
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

// Global logger instance
export const transactionLogger = new TransactionLogger();

/**
 * Enhanced Prisma client wrapper with transaction logging
 */
export function createLoggedPrismaClient(instanceId: string): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

  // Log query events
  client.$on('query', (e) => {
    transactionLogger.logQuery(
      instanceId,
      e.query,
      e.params,
      e.duration,
      true // Queries that reach this event are successful
    );
  });

  // Wrap $executeRaw and $queryRaw to catch errors
  const originalExecuteRaw = client.$executeRaw.bind(client);
  const originalQueryRaw = client.$queryRaw.bind(client);

  client.$executeRaw = async (...args: any[]) => {
    const startTime = Date.now();
    const startLogId = transactionLogger.startOperation(instanceId, 'executeRaw');
    
    try {
      const result = await originalExecuteRaw(...args);
      const duration = Date.now() - startTime;
      
      transactionLogger.endOperation(
        startLogId,
        instanceId,
        'executeRaw',
        true,
        duration
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      transactionLogger.endOperation(
        startLogId,
        instanceId,
        'executeRaw',
        false,
        duration,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  };

  client.$queryRaw = async (...args: any[]) => {
    const startTime = Date.now();
    const startLogId = transactionLogger.startOperation(instanceId, 'queryRaw');
    
    try {
      const result = await originalQueryRaw(...args);
      const duration = Date.now() - startTime;
      
      transactionLogger.endOperation(
        startLogId,
        instanceId,
        'queryRaw',
        true,
        duration
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      transactionLogger.endOperation(
        startLogId,
        instanceId,
        'queryRaw',
        false,
        duration,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  };

  // Initialize connection metrics
  transactionLogger.updateConnectionMetrics(instanceId, {
    connectionCount: 1,
    activeQueries: 0,
    poolStatus: 'healthy'
  });

  return client;
}

/**
 * Decorator for logging database operations
 */
export function logDatabaseOperation<T extends (...args: any[]) => Promise<any>>(
  instanceId: string,
  operationName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const startTime = Date.now();
    const startLogId = transactionLogger.startOperation(instanceId, operationName, {
      args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg)
    });

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;

      transactionLogger.endOperation(
        startLogId,
        instanceId,
        operationName,
        true,
        duration,
        undefined,
        { resultType: typeof result }
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      transactionLogger.endOperation(
        startLogId,
        instanceId,
        operationName,
        false,
        duration,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }) as T;
}

/**
 * Utility function to check read-after-write consistency
 */
export async function verifyReadAfterWrite(
  client: PrismaClient,
  instanceId: string,
  table: string,
  whereClause: any,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<{ found: boolean; attempts: number; totalTime: number }> {
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const logId = transactionLogger.startOperation(
      instanceId, 
      `READ_AFTER_WRITE_CHECK_${table}`,
      { attempt, whereClause }
    );

    try {
      // Dynamically access the table
      const model = (client as any)[table];
      if (!model) {
        throw new Error(`Table ${table} not found in Prisma client`);
      }

      const result = await model.findFirst({ where: whereClause });
      const found = !!result;

      transactionLogger.endOperation(
        logId,
        instanceId,
        `READ_AFTER_WRITE_CHECK_${table}`,
        true,
        Date.now() - startTime,
        undefined,
        { found, attempt }
      );

      if (found) {
        return {
          found: true,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

    } catch (error) {
      transactionLogger.endOperation(
        logId,
        instanceId,
        `READ_AFTER_WRITE_CHECK_${table}`,
        false,
        Date.now() - startTime,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }

  return {
    found: false,
    attempts: maxRetries,
    totalTime: Date.now() - startTime
  };
}

export default transactionLogger;