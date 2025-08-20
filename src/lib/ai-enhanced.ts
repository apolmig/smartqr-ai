// Enhanced AI Engine for SmartQR - Advanced Marketing Intelligence
// Designed specifically for marketers, small business owners, and SMEs

import { UserContext, AnalyticsData } from './ai-engine';

export interface MarketingContext extends UserContext {
  // Enhanced user profiling
  sessionDuration?: number;
  isReturningVisitor?: boolean;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  
  // Behavioral data
  previousScans?: number;
  lastScanDaysAgo?: number;
  engagementScore?: number;
  
  // Demographic insights
  estimatedAge?: string;
  businessCategory?: string;
  intentCategory?: 'informational' | 'commercial' | 'navigational' | 'transactional';
}

export interface SmartRoutingRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    // Device targeting
    devices?: string[];
    browsers?: string[];
    operatingSystems?: string[];
    
    // Time & location targeting
    timeRanges?: Array<{ start: number; end: number; timezone?: string }>;
    daysOfWeek?: number[];
    countries?: string[];
    cities?: string[];
    
    // Marketing targeting
    utmSources?: string[];
    utmMediums?: string[];
    referrers?: string[];
    
    // Behavioral targeting
    isReturningVisitor?: boolean;
    minSessionDuration?: number;
    minPreviousScans?: number;
    engagementThreshold?: number;
    
    // Business logic
    customLogic?: string; // JavaScript expression
  };
  targetUrl: string;
  priority: number;
  isActive: boolean;
  
  // A/B testing
  trafficSplit?: number; // 0-100 percentage
  variantId?: string;
  
  // Performance tracking
  conversions?: number;
  conversionRate?: number;
  estimatedValue?: number;
}

export interface AIInsight {
  id: string;
  type: 'performance' | 'audience' | 'timing' | 'device' | 'geographic' | 'campaign' | 'conversion';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
  actionable: boolean;
  recommendations?: string[];
  dataPoints?: Record<string, any>;
  chartData?: any;
}

export interface MarketingRecommendation {
  id: string;
  type: 'routing' | 'timing' | 'audience' | 'content' | 'abtest' | 'campaign';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  roi: 'low' | 'medium' | 'high';
  implementation: {
    steps: string[];
    autoImplementable: boolean;
    estimatedTime: string;
  };
  businessValue: string;
}

export interface EnhancedAnalytics extends AnalyticsData {
  // Conversion tracking
  conversions: {
    total: number;
    rate: number;
    bySource: Record<string, number>;
    byDevice: Record<string, number>;
    byTime: Record<string, number>;
  };
  
  // Audience insights
  audience: {
    returningVisitors: number;
    averageSessionDuration: number;
    topReferrers: Array<{ source: string; count: number }>;
    utmAnalysis: {
      sources: Record<string, number>;
      mediums: Record<string, number>;
      campaigns: Record<string, number>;
    };
    engagementDistribution: Record<string, number>;
  };
  
  // Geographic data
  geographic: {
    countries: Record<string, number>;
    cities: Record<string, number>;
    timezones: Record<string, number>;
  };
  
  // Performance metrics
  performance: {
    averageLoadTime: number;
    bounceRate: number;
    clickThroughRate: number;
    shareRate: number;
  };
  
  // Predictive metrics
  predictions: {
    expectedDailyScans: number;
    seasonalTrends: Record<string, number>;
    growthRate: number;
    churnRisk: number;
  };
}

export class EnhancedAIEngine {
  
  /**
   * Advanced smart routing with marketing intelligence
   */
  evaluateSmartRouting(rules: SmartRoutingRule[], context: MarketingContext): {
    targetUrl: string | null;
    matchedRule?: SmartRoutingRule;
    confidence: number;
    reasoning: string[];
  } {
    const activeRules = rules
      .filter(rule => rule.isActive)
      .sort((a, b) => b.priority - a.priority);

    const reasoning: string[] = [];
    
    for (const rule of activeRules) {
      const matchResult = this.evaluateRuleConditions(rule.conditions, context);
      
      if (matchResult.matches) {
        // Handle A/B testing
        if (rule.trafficSplit && rule.trafficSplit < 100) {
          const randomValue = Math.random() * 100;
          if (randomValue > rule.trafficSplit) {
            reasoning.push(`Rule "${rule.name}" matched but excluded due to A/B traffic split (${rule.trafficSplit}%)`);
            continue;
          }
          reasoning.push(`Rule "${rule.name}" selected via A/B traffic split (${rule.trafficSplit}%)`);
        }
        
        reasoning.push(`Matched rule: ${rule.name} - ${rule.description}`);
        reasoning.push(...matchResult.reasons);
        
        return {
          targetUrl: rule.targetUrl,
          matchedRule: rule,
          confidence: matchResult.confidence,
          reasoning
        };
      } else {
        reasoning.push(`Rule "${rule.name}" did not match: ${matchResult.reasons.join(', ')}`);
      }
    }

    return {
      targetUrl: null,
      confidence: 0,
      reasoning: reasoning.length > 0 ? reasoning : ['No matching rules found']
    };
  }

  /**
   * Evaluate complex rule conditions with confidence scoring
   */
  private evaluateRuleConditions(conditions: SmartRoutingRule['conditions'], context: MarketingContext): {
    matches: boolean;
    confidence: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let totalConditions = 0;
    let matchedConditions = 0;
    let confidenceSum = 0;

    // Device targeting
    if (conditions.devices && conditions.devices.length > 0) {
      totalConditions++;
      if (conditions.devices.includes(context.device)) {
        matchedConditions++;
        confidenceSum += 90;
        reasons.push(`Device matches: ${context.device}`);
      } else {
        reasons.push(`Device doesn't match: expected ${conditions.devices.join('|')}, got ${context.device}`);
      }
    }

    // Browser targeting
    if (conditions.browsers && conditions.browsers.length > 0) {
      totalConditions++;
      const browserMatch = conditions.browsers.some(browser => 
        context.browser.toLowerCase().includes(browser.toLowerCase())
      );
      if (browserMatch) {
        matchedConditions++;
        confidenceSum += 85;
        reasons.push(`Browser matches: ${context.browser}`);
      } else {
        reasons.push(`Browser doesn't match: expected ${conditions.browsers.join('|')}, got ${context.browser}`);
      }
    }

    // Time targeting
    if (conditions.timeRanges && conditions.timeRanges.length > 0) {
      totalConditions++;
      const timeMatch = conditions.timeRanges.some(range => 
        context.timeOfDay >= range.start && context.timeOfDay <= range.end
      );
      if (timeMatch) {
        matchedConditions++;
        confidenceSum += 80;
        reasons.push(`Time matches: ${context.timeOfDay}h`);
      } else {
        reasons.push(`Time doesn't match current hour: ${context.timeOfDay}`);
      }
    }

    // Geographic targeting
    if (conditions.countries && conditions.countries.length > 0 && context.country) {
      totalConditions++;
      if (conditions.countries.includes(context.country)) {
        matchedConditions++;
        confidenceSum += 95;
        reasons.push(`Country matches: ${context.country}`);
      } else {
        reasons.push(`Country doesn't match: expected ${conditions.countries.join('|')}, got ${context.country}`);
      }
    }

    // UTM source targeting
    if (conditions.utmSources && conditions.utmSources.length > 0 && context.utmSource) {
      totalConditions++;
      if (conditions.utmSources.includes(context.utmSource)) {
        matchedConditions++;
        confidenceSum += 90;
        reasons.push(`UTM source matches: ${context.utmSource}`);
      } else {
        reasons.push(`UTM source doesn't match: expected ${conditions.utmSources.join('|')}, got ${context.utmSource}`);
      }
    }

    // Returning visitor targeting
    if (conditions.isReturningVisitor !== undefined) {
      totalConditions++;
      if (conditions.isReturningVisitor === context.isReturningVisitor) {
        matchedConditions++;
        confidenceSum += 75;
        reasons.push(`Visitor type matches: ${context.isReturningVisitor ? 'returning' : 'new'}`);
      } else {
        reasons.push(`Visitor type doesn't match: expected ${conditions.isReturningVisitor ? 'returning' : 'new'}`);
      }
    }

    // Engagement threshold
    if (conditions.engagementThreshold && context.engagementScore !== undefined) {
      totalConditions++;
      if (context.engagementScore >= conditions.engagementThreshold) {
        matchedConditions++;
        confidenceSum += 70;
        reasons.push(`Engagement score meets threshold: ${context.engagementScore} >= ${conditions.engagementThreshold}`);
      } else {
        reasons.push(`Engagement score below threshold: ${context.engagementScore} < ${conditions.engagementThreshold}`);
      }
    }

    // Custom logic evaluation
    if (conditions.customLogic) {
      totalConditions++;
      try {
        const result = this.evaluateCustomLogic(conditions.customLogic, context);
        if (result) {
          matchedConditions++;
          confidenceSum += 60;
          reasons.push(`Custom logic evaluated to true`);
        } else {
          reasons.push(`Custom logic evaluated to false`);
        }
      } catch (error) {
        reasons.push(`Custom logic error: ${error.message}`);
      }
    }

    const matches = totalConditions === 0 || matchedConditions === totalConditions;
    const confidence = totalConditions > 0 ? confidenceSum / totalConditions : 0;

    return { matches, confidence, reasons };
  }

  /**
   * Safe evaluation of custom JavaScript logic
   */
  private evaluateCustomLogic(logic: string, context: MarketingContext): boolean {
    // Simple and safe evaluation for basic conditions
    // In production, consider using a proper expression evaluator
    try {
      const safeContext = {
        device: context.device,
        browser: context.browser,
        timeOfDay: context.timeOfDay,
        dayOfWeek: context.dayOfWeek,
        country: context.country,
        utmSource: context.utmSource,
        isReturningVisitor: context.isReturningVisitor,
        engagementScore: context.engagementScore || 0,
        sessionDuration: context.sessionDuration || 0
      };

      // Replace context variables in the logic string
      let evaluableLogic = logic;
      Object.entries(safeContext).forEach(([key, value]) => {
        evaluableLogic = evaluableLogic.replace(
          new RegExp(`\\b${key}\\b`, 'g'), 
          typeof value === 'string' ? `"${value}"` : String(value)
        );
      });

      // Only allow safe operations
      if (/[^a-zA-Z0-9\s"'>=<!&|().,+-/*%]/.test(evaluableLogic)) {
        throw new Error('Unsafe characters in custom logic');
      }

      return Function(`"use strict"; return (${evaluableLogic})`)();
    } catch (error) {
      console.error('Custom logic evaluation error:', error);
      return false;
    }
  }

  /**
   * Generate advanced AI insights for marketers
   */
  generateMarketingInsights(analytics: EnhancedAnalytics): AIInsight[] {
    const insights: AIInsight[] = [];

    // Performance insights
    if (analytics.totalScans > 100) {
      const conversionRate = analytics.conversions.rate;
      
      if (conversionRate > 5) {
        insights.push({
          id: 'high-conversion',
          type: 'performance',
          title: 'Excellent Conversion Performance',
          description: `Your QR code is converting at ${conversionRate.toFixed(1)}%, which is above industry average of 2-3%.`,
          impact: 'high',
          confidence: 95,
          actionable: true,
          recommendations: [
            'Scale this successful campaign to similar audiences',
            'Analyze top-performing traffic sources for replication',
            'Create lookalike campaigns based on converting users'
          ],
          dataPoints: { conversionRate, industry_avg: 2.5 }
        });
      } else if (conversionRate < 1) {
        insights.push({
          id: 'low-conversion',
          type: 'conversion',
          title: 'Conversion Rate Below Expectations',
          description: `Current conversion rate of ${conversionRate.toFixed(1)}% suggests optimization opportunities.`,
          impact: 'high',
          confidence: 90,
          actionable: true,
          recommendations: [
            'Review landing page relevance and load time',
            'A/B test different call-to-action messages',
            'Implement device-specific landing pages',
            'Add urgency or incentive elements'
          ],
          dataPoints: { conversionRate, target: 2.5 }
        });
      }
    }

    // Audience insights
    const mobilePercent = (analytics.deviceBreakdown.mobile || 0) / analytics.totalScans * 100;
    if (mobilePercent > 80) {
      insights.push({
        id: 'mobile-dominant',
        type: 'audience',
        title: 'Mobile-First Audience',
        description: `${mobilePercent.toFixed(0)}% of your audience uses mobile devices.`,
        impact: 'high',
        confidence: 95,
        actionable: true,
        recommendations: [
          'Optimize for mobile-first design and fast loading',
          'Use larger buttons and touch-friendly interfaces',
          'Consider mobile-specific offers or experiences',
          'Test mobile app deep-linking opportunities'
        ],
        dataPoints: { mobilePercent }
      });
    }

    // Timing insights
    const businessHours = analytics.timePatterns.business_hours || 0;
    const afterHours = analytics.timePatterns.after_hours || 0;
    
    if (afterHours > businessHours * 1.5) {
      insights.push({
        id: 'after-hours-activity',
        type: 'timing',
        title: 'High After-Hours Engagement',
        description: 'Your audience is most active outside business hours.',
        impact: 'medium',
        confidence: 85,
        actionable: true,
        recommendations: [
          'Schedule content updates for evening hours',
          'Create time-based messaging for different hours',
          'Consider automated responses for off-hours inquiries'
        ]
      });
    }

    // Geographic insights
    const topCountries = Object.entries(analytics.geographic.countries)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (topCountries.length > 1 && topCountries[0][1] < analytics.totalScans * 0.7) {
      insights.push({
        id: 'geographic-diversity',
        type: 'geographic',
        title: 'Diverse Geographic Audience',
        description: `Your audience spans multiple countries: ${topCountries.map(([country]) => country).join(', ')}`,
        impact: 'medium',
        confidence: 80,
        actionable: true,
        recommendations: [
          'Create country-specific landing pages',
          'Implement geo-targeted messaging',
          'Consider local time zones for content updates',
          'Test localized offers and currencies'
        ],
        dataPoints: { topCountries }
      });
    }

    // Campaign insights
    if (analytics.audience.utmAnalysis.sources && Object.keys(analytics.audience.utmAnalysis.sources).length > 1) {
      const bestSource = Object.entries(analytics.audience.utmAnalysis.sources)
        .sort(([,a], [,b]) => b - a)[0];
      
      insights.push({
        id: 'multi-channel-success',
        type: 'campaign',
        title: 'Multi-Channel Performance',
        description: `Best performing source: ${bestSource[0]} with ${bestSource[1]} scans`,
        impact: 'medium',
        confidence: 75,
        actionable: true,
        recommendations: [
          `Double down on ${bestSource[0]} channel investments`,
          'Analyze successful messaging from top channels',
          'Cross-pollinate successful tactics across channels'
        ]
      });
    }

    return insights;
  }

  /**
   * Generate actionable marketing recommendations
   */
  generateMarketingRecommendations(analytics: EnhancedAnalytics, insights: AIInsight[]): MarketingRecommendation[] {
    const recommendations: MarketingRecommendation[] = [];

    // Smart routing recommendations
    const mobilePercent = (analytics.deviceBreakdown.mobile || 0) / analytics.totalScans * 100;
    if (mobilePercent > 70 && analytics.totalScans > 50) {
      recommendations.push({
        id: 'mobile-routing',
        type: 'routing',
        title: 'Implement Mobile-Specific Routing',
        description: 'Create dedicated mobile experiences for your predominantly mobile audience',
        expectedImpact: '+15-25% conversion rate improvement',
        effort: 'medium',
        roi: 'high',
        implementation: {
          steps: [
            'Create mobile-optimized landing page',
            'Set up mobile device targeting rule',
            'A/B test mobile vs desktop experiences',
            'Monitor mobile conversion metrics'
          ],
          autoImplementable: true,
          estimatedTime: '2-3 hours'
        },
        businessValue: 'Higher conversions from mobile traffic, improved user experience, competitive advantage'
      });
    }

    // A/B testing recommendations
    if (analytics.totalScans > 100 && analytics.conversions.rate < 3) {
      recommendations.push({
        id: 'ab-test-landing',
        type: 'abtest',
        title: 'A/B Test Landing Page Variations',
        description: 'Test different headlines, CTAs, and layouts to improve conversion rates',
        expectedImpact: '+30-50% conversion improvement',
        effort: 'medium',
        roi: 'high',
        implementation: {
          steps: [
            'Create 2-3 landing page variations',
            'Set up 50/50 traffic split rules',
            'Define conversion tracking goals',
            'Run test for minimum 2 weeks',
            'Implement winning variation'
          ],
          autoImplementable: false,
          estimatedTime: '4-6 hours setup + 2 weeks testing'
        },
        businessValue: 'Significant conversion improvements, data-driven optimization, reduced customer acquisition cost'
      });
    }

    // Timing optimization
    const hasTimePatterns = Object.keys(analytics.timePatterns).length > 0;
    if (hasTimePatterns && analytics.totalScans > 50) {
      recommendations.push({
        id: 'time-based-content',
        type: 'timing',
        title: 'Implement Time-Based Content Strategy',
        description: 'Show different content based on time of day to match user intent',
        expectedImpact: '+10-20% engagement improvement',
        effort: 'low',
        roi: 'medium',
        implementation: {
          steps: [
            'Analyze peak activity hours from data',
            'Create time-specific content variations',
            'Set up time-based routing rules',
            'Monitor engagement by time period'
          ],
          autoImplementable: true,
          estimatedTime: '1-2 hours'
        },
        businessValue: 'Higher relevance, improved user experience, better message timing'
      });
    }

    // Geographic expansion
    const topCountries = Object.entries(analytics.geographic.countries);
    if (topCountries.length > 1) {
      recommendations.push({
        id: 'geo-expansion',
        type: 'audience',
        title: 'Geographic Market Expansion',
        description: 'Leverage successful performance to expand into similar markets',
        expectedImpact: '+25-40% total audience growth',
        effort: 'high',
        roi: 'high',
        implementation: {
          steps: [
            'Analyze top-performing geographic markets',
            'Research similar markets with expansion potential',
            'Create localized content and landing pages',
            'Set up geo-targeted campaigns',
            'Monitor performance by region'
          ],
          autoImplementable: false,
          estimatedTime: '1-2 weeks'
        },
        businessValue: 'Market expansion, diversified revenue streams, reduced dependency on single markets'
      });
    }

    return recommendations;
  }

  /**
   * Predict optimal QR code placement and marketing strategies
   */
  predictOptimalStrategy(analytics: EnhancedAnalytics): {
    placement: string[];
    timing: string[];
    audience: string[];
    content: string[];
  } {
    const predictions = {
      placement: [] as string[],
      timing: [] as string[],
      audience: [] as string[],
      content: [] as string[]
    };

    // Placement predictions
    const mobilePercent = (analytics.deviceBreakdown.mobile || 0) / analytics.totalScans * 100;
    if (mobilePercent > 70) {
      predictions.placement.push('Mobile-first environments: social media, mobile apps, SMS campaigns');
      predictions.placement.push('Physical locations with high mobile usage: cafes, waiting areas, events');
    } else {
      predictions.placement.push('Desktop-friendly environments: office buildings, co-working spaces');
      predictions.placement.push('Print materials: brochures, business cards, posters');
    }

    // Timing predictions
    const peakHour = Object.entries(analytics.timePatterns)
      .reduce((max, [hour, count]) => count > max.count ? { hour, count } : max, { hour: '0', count: 0 });
    
    if (parseInt(peakHour.hour) >= 9 && parseInt(peakHour.hour) <= 17) {
      predictions.timing.push('Business hours (9 AM - 5 PM) show highest engagement');
      predictions.timing.push('Target B2B audiences during weekdays');
    } else {
      predictions.timing.push('Evening/weekend hours show peak activity');
      predictions.timing.push('Focus on B2C and leisure-time messaging');
    }

    // Audience predictions
    if (analytics.audience.returningVisitors > analytics.totalScans * 0.3) {
      predictions.audience.push('High returning visitor rate indicates strong brand affinity');
      predictions.audience.push('Focus on loyalty programs and repeat customer offers');
    } else {
      predictions.audience.push('High new visitor rate suggests good discovery and awareness');
      predictions.audience.push('Optimize for first-impression and onboarding experiences');
    }

    // Content predictions
    if (analytics.conversions.rate > 3) {
      predictions.content.push('Current messaging resonates well - scale successful elements');
      predictions.content.push('Test premium offerings and upsell opportunities');
    } else {
      predictions.content.push('Messaging needs optimization - test different value propositions');
      predictions.content.push('Focus on clearer benefits and stronger call-to-actions');
    }

    return predictions;
  }

  /**
   * Calculate ROI and business impact projections
   */
  calculateROIProjections(analytics: EnhancedAnalytics, recommendations: MarketingRecommendation[]): {
    currentMetrics: Record<string, number>;
    projectedImprovements: Record<string, number>;
    estimatedRevenue: Record<string, number>;
  } {
    const currentMetrics = {
      conversionRate: analytics.conversions.rate,
      monthlyScans: analytics.totalScans * 30, // Estimate monthly
      monthlyConversions: analytics.conversions.total * 30,
      averageOrderValue: 50, // Default estimate
    };

    const projectedImprovements = {
      conversionRateIncrease: 0,
      scanVolumeIncrease: 0,
      engagementIncrease: 0,
    };

    // Calculate improvement potential from recommendations
    recommendations.forEach(rec => {
      if (rec.roi === 'high') {
        if (rec.type === 'routing' || rec.type === 'abtest') {
          projectedImprovements.conversionRateIncrease += 20; // 20% improvement
        }
        if (rec.type === 'audience') {
          projectedImprovements.scanVolumeIncrease += 30; // 30% more scans
        }
      } else if (rec.roi === 'medium') {
        projectedImprovements.conversionRateIncrease += 10;
        projectedImprovements.scanVolumeIncrease += 15;
      }
    });

    const estimatedRevenue = {
      currentMonthly: currentMetrics.monthlyConversions * currentMetrics.averageOrderValue,
      projectedMonthly: 0,
      annualIncrease: 0,
    };

    const newConversionRate = currentMetrics.conversionRate * (1 + projectedImprovements.conversionRateIncrease / 100);
    const newMonthlyScans = currentMetrics.monthlyScans * (1 + projectedImprovements.scanVolumeIncrease / 100);
    const newMonthlyConversions = (newMonthlyScans * newConversionRate) / 100;

    estimatedRevenue.projectedMonthly = newMonthlyConversions * currentMetrics.averageOrderValue;
    estimatedRevenue.annualIncrease = (estimatedRevenue.projectedMonthly - estimatedRevenue.currentMonthly) * 12;

    return { currentMetrics, projectedImprovements, estimatedRevenue };
  }
}

export const enhancedAI = new EnhancedAIEngine();