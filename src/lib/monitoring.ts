// Performance monitoring and analytics
export class MonitoringService {
  static trackEvent(eventName: string, properties: Record<string, any> = {}) {
    if (typeof window === 'undefined') return;

    try {
      // Track with analytics service (replace with your preferred service)
      if (window.gtag) {
        window.gtag('event', eventName, {
          custom_map: properties,
          event_category: 'user_interaction',
        });
      }

      // Log for development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Event:', eventName, properties);
      }
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  static trackQRScan(qrId: string, userAgent: string, source?: string) {
    this.trackEvent('qr_scan', {
      qr_id: qrId,
      user_agent: userAgent,
      source: source || 'direct',
      timestamp: new Date().toISOString(),
    });
  }

  static trackQRCreation(planType: string) {
    this.trackEvent('qr_created', {
      plan_type: planType,
      timestamp: new Date().toISOString(),
    });
  }

  static trackPlanUpgrade(fromPlan: string, toPlan: string) {
    this.trackEvent('plan_upgrade', {
      from_plan: fromPlan,
      to_plan: toPlan,
      timestamp: new Date().toISOString(),
    });
  }

  static trackPageView(pageName: string) {
    this.trackEvent('page_view', {
      page_name: pageName,
      timestamp: new Date().toISOString(),
    });
  }

  static logError(error: Error, context?: Record<string, any>) {
    try {
      // Send to error tracking service (Sentry, Bugsnag, etc.)
      if (process.env.NODE_ENV === 'production') {
        // window.Sentry?.captureException(error, { extra: context });
      }

      console.error('Application Error:', error, context);
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  static measurePerformance(name: string, fn: () => Promise<any>) {
    return async (...args: any[]) => {
      const startTime = performance.now();
      
      try {
        const result = await fn();
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.trackEvent('performance_measure', {
          operation: name,
          duration_ms: Math.round(duration),
          success: true,
        });

        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.trackEvent('performance_measure', {
          operation: name,
          duration_ms: Math.round(duration),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    };
  }
}

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    MonitoringService.logError(
      new Error(event.reason),
      { type: 'unhandled_promise_rejection' }
    );
  });

  window.addEventListener('error', (event) => {
    MonitoringService.logError(
      event.error,
      { 
        type: 'unhandled_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    );
  });
}

// Extend window type for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    Sentry?: {
      captureException: (error: Error, options?: any) => void;
    };
  }
}