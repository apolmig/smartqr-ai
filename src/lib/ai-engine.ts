// AI Engine for Smart QR Routing
// Starts simple, evolves intelligent

export interface UserContext {
  device: string;
  os: string;
  browser: string;
  timeOfDay: number;
  dayOfWeek: number;
  userAgent: string;
  ipAddress?: string;
  country?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: string; // Simple conditions like "mobile", "business_hours", etc.
  targetUrl: string;
  priority: number;
  isActive: boolean;
}

export interface AnalyticsData {
  totalScans: number;
  deviceBreakdown: Record<string, number>;
  timePatterns: Record<string, number>;
  conversionByRule?: Record<string, number>;
}

export class AIEngine {
  // Phase 1: Rule-based routing
  evaluateRoutingRules(rules: RoutingRule[], context: UserContext): string | null {
    const activeRules = rules
      .filter(rule => rule.isActive)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of activeRules) {
      if (this.matchesCondition(rule.condition, context)) {
        return rule.targetUrl;
      }
    }

    return null;
  }

  // Evaluate complex conditions for variants
  evaluateConditions(conditions: any, context: UserContext): boolean {
    if (!conditions) return true;

    // Handle different condition types
    if (conditions.device && conditions.device !== context.device) {
      return false;
    }

    if (conditions.os && !context.os.toLowerCase().includes(conditions.os.toLowerCase())) {
      return false;
    }

    if (conditions.browser && !context.browser.toLowerCase().includes(conditions.browser.toLowerCase())) {
      return false;
    }

    // Time-based conditions
    if (conditions.timeRange) {
      const { start, end } = conditions.timeRange;
      if (context.timeOfDay < start || context.timeOfDay > end) {
        return false;
      }
    }

    // Day-based conditions
    if (conditions.daysOfWeek && !conditions.daysOfWeek.includes(context.dayOfWeek)) {
      return false;
    }

    // Country-based conditions
    if (conditions.countries && context.country && !conditions.countries.includes(context.country)) {
      return false;
    }

    return true;
  }

  private matchesCondition(condition: string, context: UserContext): boolean {
    const lowerCondition = condition.toLowerCase();

    // Device-based routing
    if (lowerCondition === 'mobile' && context.device === 'mobile') return true;
    if (lowerCondition === 'desktop' && context.device === 'desktop') return true;
    if (lowerCondition === 'tablet' && context.device === 'tablet') return true;

    // Time-based routing
    if (lowerCondition === 'business_hours' && this.isBusinessHours(context.timeOfDay)) return true;
    if (lowerCondition === 'after_hours' && !this.isBusinessHours(context.timeOfDay)) return true;
    if (lowerCondition === 'weekend' && this.isWeekend(context.dayOfWeek)) return true;
    if (lowerCondition === 'weekday' && !this.isWeekend(context.dayOfWeek)) return true;

    // Browser-based routing
    if (lowerCondition === 'chrome' && context.browser.toLowerCase().includes('chrome')) return true;
    if (lowerCondition === 'safari' && context.browser.toLowerCase().includes('safari')) return true;
    if (lowerCondition === 'firefox' && context.browser.toLowerCase().includes('firefox')) return true;

    // OS-based routing
    if (lowerCondition === 'ios' && context.os.toLowerCase().includes('ios')) return true;
    if (lowerCondition === 'android' && context.os.toLowerCase().includes('android')) return true;
    if (lowerCondition === 'windows' && context.os.toLowerCase().includes('windows')) return true;
    if (lowerCondition === 'macos' && context.os.toLowerCase().includes('macos')) return true;

    return false;
  }

  private isBusinessHours(hour: number): boolean {
    return hour >= 9 && hour <= 17;
  }

  private isWeekend(dayOfWeek: number): boolean {
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  }

  // Phase 2: Analytics-based insights
  generateInsights(analytics: AnalyticsData): string[] {
    const insights: string[] = [];

    // Device insights
    const totalScans = analytics.totalScans;
    if (totalScans > 10) {
      const mobileScans = analytics.deviceBreakdown.mobile || 0;
      const mobilePercentage = (mobileScans / totalScans) * 100;
      
      if (mobilePercentage > 70) {
        insights.push("📱 70%+ of your scans are from mobile devices. Consider optimizing for mobile-first experience.");
      }
      
      if (mobilePercentage < 30) {
        insights.push("💻 Most scans are from desktop. Consider creating desktop-optimized landing pages.");
      }
    }

    // Time-based insights
    const businessHourScans = analytics.timePatterns.business_hours || 0;
    const afterHourScans = analytics.timePatterns.after_hours || 0;
    
    if (businessHourScans > afterHourScans * 2) {
      insights.push("🕒 Most scans happen during business hours. Schedule content updates accordingly.");
    } else if (afterHourScans > businessHourScans) {
      insights.push("🌙 High activity after business hours. Consider evening-focused messaging.");
    }

    // Performance insights
    if (totalScans > 50) {
      insights.push("🚀 Great engagement! Consider enabling A/B testing to optimize conversion rates.");
    }

    return insights;
  }

  // Phase 3: Smart suggestions (simple ML-like logic)
  suggestOptimizations(analytics: AnalyticsData): Array<{
    type: string;
    suggestion: string;
    impact: 'high' | 'medium' | 'low';
  }> {
    const suggestions: Array<{
      type: string;
      suggestion: string;
      impact: 'high' | 'medium' | 'low';
    }> = [];

    const totalScans = analytics.totalScans;
    
    if (totalScans < 10) {
      suggestions.push({
        type: 'placement',
        suggestion: 'Place QR code in higher-traffic locations for more scans',
        impact: 'high'
      });
    }

    // Device-based suggestions
    const mobileRatio = (analytics.deviceBreakdown.mobile || 0) / totalScans;
    if (mobileRatio > 0.8 && totalScans > 20) {
      suggestions.push({
        type: 'mobile_optimization',
        suggestion: 'Create mobile-specific landing page to improve conversion',
        impact: 'high'
      });
    }

    // Time-based suggestions
    const hasTimeData = Object.keys(analytics.timePatterns).length > 0;
    if (hasTimeData && totalScans > 25) {
      suggestions.push({
        type: 'time_targeting',
        suggestion: 'Enable time-based routing to show different content by hour',
        impact: 'medium'
      });
    }

    return suggestions;
  }

  // Default routing rules for new QR codes
  getDefaultRules(): RoutingRule[] {
    return [
      {
        id: 'mobile_rule',
        name: 'Mobile Optimization',
        condition: 'mobile',
        targetUrl: '', // Will be set to mobile-optimized version
        priority: 10,
        isActive: false
      },
      {
        id: 'business_hours',
        name: 'Business Hours',
        condition: 'business_hours',
        targetUrl: '', // Will be set to business hours version
        priority: 5,
        isActive: false
      },
      {
        id: 'weekend_rule',
        name: 'Weekend Traffic',
        condition: 'weekend',
        targetUrl: '', // Will be set to weekend version
        priority: 3,
        isActive: false
      }
    ];
  }
}

export const aiEngine = new AIEngine();