// Performance Monitoring System for SmartQR AI
// Tracks and optimizes AI performance, database queries, and user experience

interface PerformanceMetric {
  id: string;
  type: 'database' | 'ai_routing' | 'analytics' | 'api' | 'user_experience';
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'percentage' | 'bytes';
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface PerformanceAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: PerformanceMetric;
  threshold: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: Record<string, number> = {
    'qr_redirect_time': 500, // ms
    'analytics_query_time': 2000, // ms
    'ai_routing_time': 200, // ms
    'database_connection_count': 15,
    'error_rate': 5, // percentage
  };

  /**
   * Track a performance metric
   */
  track(
    type: PerformanceMetric['type'],
    name: string,
    value: number,
    unit: PerformanceMetric['unit'] = 'ms',
    metadata?: Record<string, any>
  ) {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      type,
      name,
      value,
      unit,
      timestamp: new Date(),
      metadata,
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);
    this.cleanupOldMetrics();

    // Log performance issues in development
    if (process.env.NODE_ENV === 'development') {
      this.logMetric(metric);
    }

    return metric;
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    type: PerformanceMetric['type'],
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.track(type, name, duration, 'ms', {
        ...metadata,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.track(type, `${name}_error`, duration, 'ms', {
        ...metadata,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  /**
   * Get performance summary
   */
  getSummary(timeframe: 'last_hour' | 'last_day' | 'last_week' = 'last_hour') {
    const cutoff = this.getTimeframeCutoff(timeframe);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    const summary = {
      totalMetrics: recentMetrics.length,
      averageResponseTime: this.calculateAverage(recentMetrics.filter(m => m.unit === 'ms'), 'value'),
      errorCount: recentMetrics.filter(m => m.metadata?.success === false).length,
      alerts: this.alerts.filter(a => a.timestamp >= cutoff),
      breakdown: this.getBreakdownByType(recentMetrics),
    };

    return summary;
  }

  /**
   * Get real-time performance dashboard data
   */
  getDashboard() {
    const lastHourMetrics = this.metrics.filter(
      m => m.timestamp >= new Date(Date.now() - 60 * 60 * 1000)
    );

    return {
      qrRedirectPerformance: {
        averageTime: this.calculateAverage(
          lastHourMetrics.filter(m => m.name.includes('qr_redirect')),
          'value'
        ),
        p95Time: this.calculatePercentile(
          lastHourMetrics.filter(m => m.name.includes('qr_redirect')),
          'value',
          95
        ),
        totalRequests: lastHourMetrics.filter(m => m.name.includes('qr_redirect')).length,
      },
      aiRoutingPerformance: {
        averageTime: this.calculateAverage(
          lastHourMetrics.filter(m => m.name.includes('ai_routing')),
          'value'
        ),
        successRate: this.calculateSuccessRate(
          lastHourMetrics.filter(m => m.name.includes('ai_routing'))
        ),
        totalDecisions: lastHourMetrics.filter(m => m.name.includes('ai_routing')).length,
      },
      analyticsPerformance: {
        averageQueryTime: this.calculateAverage(
          lastHourMetrics.filter(m => m.name.includes('analytics')),
          'value'
        ),
        cacheHitRate: this.calculateCacheHitRate(lastHourMetrics),
      },
      systemHealth: {
        errorRate: this.calculateErrorRate(lastHourMetrics),
        alerts: this.alerts.filter(
          a => a.timestamp >= new Date(Date.now() - 60 * 60 * 1000)
        ).length,
        status: this.getSystemStatus(),
      },
    };
  }

  /**
   * Check if metrics exceed thresholds and create alerts
   */
  private checkThresholds(metric: PerformanceMetric) {
    const threshold = this.thresholds[metric.name];
    
    if (threshold && metric.value > threshold) {
      const alert: PerformanceAlert = {
        id: this.generateId(),
        severity: this.calculateSeverity(metric.value, threshold),
        message: `${metric.name} exceeded threshold: ${metric.value}${metric.unit} > ${threshold}${metric.unit}`,
        metric,
        threshold,
        timestamp: new Date(),
      };

      this.alerts.push(alert);
      
      // Log critical alerts immediately
      if (alert.severity === 'critical') {
        console.error('🚨 Critical Performance Alert:', alert);
      }
    }
  }

  /**
   * Calculate severity based on how much threshold is exceeded
   */
  private calculateSeverity(value: number, threshold: number): PerformanceAlert['severity'] {
    const ratio = value / threshold;
    
    if (ratio >= 5) return 'critical';
    if (ratio >= 3) return 'high';
    if (ratio >= 2) return 'medium';
    return 'low';
  }

  /**
   * Get system status based on recent metrics
   */
  private getSystemStatus(): 'healthy' | 'degraded' | 'critical' {
    const recentAlerts = this.alerts.filter(
      a => a.timestamp >= new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical').length;
    const highAlerts = recentAlerts.filter(a => a.severity === 'high').length;

    if (criticalAlerts > 0) return 'critical';
    if (highAlerts > 2 || recentAlerts.length > 5) return 'degraded';
    return 'healthy';
  }

  /**
   * Log metrics in development for debugging
   */
  private logMetric(metric: PerformanceMetric) {
    if (metric.value > (this.thresholds[metric.name] || 1000)) {
      console.warn(`⚠️  Slow ${metric.name}: ${metric.value}${metric.unit}`, {
        metadata: metric.metadata,
      });
    }
  }

  /**
   * Utility functions
   */
  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTimeframeCutoff(timeframe: 'last_hour' | 'last_day' | 'last_week'): Date {
    const now = Date.now();
    switch (timeframe) {
      case 'last_hour': return new Date(now - 60 * 60 * 1000);
      case 'last_day': return new Date(now - 24 * 60 * 60 * 1000);
      case 'last_week': return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
  }

  private calculateAverage(metrics: PerformanceMetric[], field: keyof PerformanceMetric): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + (m[field] as number), 0);
    return Math.round(sum / metrics.length);
  }

  private calculatePercentile(metrics: PerformanceMetric[], field: keyof PerformanceMetric, percentile: number): number {
    if (metrics.length === 0) return 0;
    
    const values = metrics.map(m => m[field] as number).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[index] || 0;
  }

  private calculateSuccessRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 100;
    
    const successful = metrics.filter(m => m.metadata?.success !== false).length;
    return Math.round((successful / metrics.length) * 100);
  }

  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    
    const errors = metrics.filter(m => m.metadata?.success === false).length;
    return Math.round((errors / metrics.length) * 100);
  }

  private calculateCacheHitRate(metrics: PerformanceMetric[]): number {
    const cacheMetrics = metrics.filter(m => m.name.includes('cache'));
    if (cacheMetrics.length === 0) return 0;
    
    const hits = cacheMetrics.filter(m => m.metadata?.cache_hit === true).length;
    return Math.round((hits / cacheMetrics.length) * 100);
  }

  private getBreakdownByType(metrics: PerformanceMetric[]) {
    const breakdown: Record<string, any> = {};
    
    for (const type of ['database', 'ai_routing', 'analytics', 'api', 'user_experience'] as const) {
      const typeMetrics = metrics.filter(m => m.type === type);
      breakdown[type] = {
        count: typeMetrics.length,
        averageTime: this.calculateAverage(typeMetrics, 'value'),
        errorRate: this.calculateErrorRate(typeMetrics),
      };
    }
    
    return breakdown;
  }

  private cleanupOldMetrics() {
    // Keep only last 24 hours of metrics in memory
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Middleware-style wrapper for monitoring API routes
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  name: string,
  type: PerformanceMetric['type'],
  handler: T
): T {
  return (async (...args: any[]) => {
    return performanceMonitor.timeFunction(type, name, () => handler(...args), {
      args: args.length,
    });
  }) as T;
}

// Decorator for monitoring database operations
export function monitorDatabaseOperation(operationName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.timeFunction(
        'database',
        operationName,
        () => originalMethod.apply(this, args),
        {
          method: propertyKey,
          args: args.length,
        }
      );
    };
    
    return descriptor;
  };
}

// Helper functions for common performance tracking
export const PerfTrackers = {
  trackQRRedirect: (shortId: string) => 
    performanceMonitor.timeFunction('user_experience', 'qr_redirect', () => Promise.resolve(), { shortId }),
    
  trackAIRouting: (qrCodeId: string, ruleCount: number) =>
    performanceMonitor.timeFunction('ai_routing', 'ai_routing_decision', () => Promise.resolve(), { qrCodeId, ruleCount }),
    
  trackAnalyticsQuery: (queryType: string, dataSize: number) =>
    performanceMonitor.timeFunction('analytics', `analytics_${queryType}`, () => Promise.resolve(), { dataSize }),
    
  trackDatabaseQuery: (queryType: string, recordCount?: number) =>
    performanceMonitor.timeFunction('database', `db_${queryType}`, () => Promise.resolve(), { recordCount }),
};

export default performanceMonitor;