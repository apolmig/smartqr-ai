import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { enhancedAI, EnhancedAnalytics } from '@/lib/ai-enhanced';
import { ApiResponseHelper } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get QR code data
    const qrCode = await prisma.qRCode.findUnique({
      where: { id },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 1000 // Last 1000 scans for analysis
        },
        variants: true,
        user: true
      }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Build enhanced analytics data
    const analytics = await buildEnhancedAnalytics(qrCode);
    
    // Generate AI insights
    const insights = enhancedAI.generateMarketingInsights(analytics);
    
    // Generate marketing recommendations
    const recommendations = enhancedAI.generateMarketingRecommendations(analytics, insights);
    
    // Get optimal strategy predictions
    const strategy = enhancedAI.predictOptimalStrategy(analytics);
    
    // Calculate ROI projections
    const roiProjections = enhancedAI.calculateROIProjections(analytics, recommendations);

    return ApiResponseHelper.success({
      qrCode: {
        id: qrCode.id,
        name: qrCode.name,
        shortId: qrCode.shortId,
        totalScans: qrCode.totalScans,
        enableAI: qrCode.enableAI
      },
      analytics,
      insights,
      recommendations,
      strategy,
      roiProjections,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    return ApiResponseHelper.internalError('Failed to fetch analytics');
  }
}

async function buildEnhancedAnalytics(qrCode: any): Promise<EnhancedAnalytics> {
  const scans = qrCode.scans;
  const totalScans = scans.length;
  
  // Device breakdown
  const deviceBreakdown: Record<string, number> = {};
  scans.forEach((scan: any) => {
    deviceBreakdown[scan.device] = (deviceBreakdown[scan.device] || 0) + 1;
  });
  
  // Time patterns
  const timePatterns: Record<string, number> = {
    business_hours: 0,
    after_hours: 0,
    weekend: 0,
    weekday: 0
  };
  
  scans.forEach((scan: any) => {
    const hour = new Date(scan.scannedAt).getHours();
    const day = new Date(scan.scannedAt).getDay();
    
    if (hour >= 9 && hour <= 17) {
      timePatterns.business_hours++;
    } else {
      timePatterns.after_hours++;
    }
    
    if (day === 0 || day === 6) {
      timePatterns.weekend++;
    } else {
      timePatterns.weekday++;
    }
  });
  
  // Geographic breakdown
  const countries: Record<string, number> = {};
  const cities: Record<string, number> = {};
  const timezones: Record<string, number> = {};
  
  scans.forEach((scan: any) => {
    if (scan.country) {
      countries[scan.country] = (countries[scan.country] || 0) + 1;
    }
    if (scan.city) {
      cities[scan.city] = (cities[scan.city] || 0) + 1;
    }
    // Estimate timezone from country (simplified)
    if (scan.country) {
      const tz = getTimezoneForCountry(scan.country);
      timezones[tz] = (timezones[tz] || 0) + 1;
    }
  });
  
  // UTM analysis
  const utmSources: Record<string, number> = {};
  const utmMediums: Record<string, number> = {};
  const utmCampaigns: Record<string, number> = {};
  const topReferrers: Array<{ source: string; count: number }> = [];
  
  let returningVisitors = 0;
  let totalSessionDuration = 0;
  let sessionsWithDuration = 0;
  
  scans.forEach((scan: any) => {
    if (scan.additionalData) {
      try {
        const data = JSON.parse(scan.additionalData);
        
        if (data.utmSource) {
          utmSources[data.utmSource] = (utmSources[data.utmSource] || 0) + 1;
        }
        if (data.utmMedium) {
          utmMediums[data.utmMedium] = (utmMediums[data.utmMedium] || 0) + 1;
        }
        if (data.utmCampaign) {
          utmCampaigns[data.utmCampaign] = (utmCampaigns[data.utmCampaign] || 0) + 1;
        }
        if (data.isReturningVisitor) {
          returningVisitors++;
        }
        if (data.sessionDuration) {
          totalSessionDuration += data.sessionDuration;
          sessionsWithDuration++;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
  });
  
  // Simple conversion tracking (can be enhanced with actual conversion data)
  const estimatedConversions = Math.floor(totalScans * 0.025); // 2.5% estimated conversion rate
  const conversionRate = totalScans > 0 ? (estimatedConversions / totalScans) * 100 : 0;
  
  return {
    totalScans,
    deviceBreakdown,
    timePatterns,
    
    conversions: {
      total: estimatedConversions,
      rate: conversionRate,
      bySource: utmSources,
      byDevice: deviceBreakdown,
      byTime: timePatterns
    },
    
    audience: {
      returningVisitors,
      averageSessionDuration: sessionsWithDuration > 0 ? totalSessionDuration / sessionsWithDuration : 0,
      topReferrers,
      utmAnalysis: {
        sources: utmSources,
        mediums: utmMediums,
        campaigns: utmCampaigns
      },
      engagementDistribution: {
        'high': Math.floor(totalScans * 0.2),
        'medium': Math.floor(totalScans * 0.5),
        'low': Math.floor(totalScans * 0.3)
      }
    },
    
    geographic: {
      countries,
      cities,
      timezones
    },
    
    performance: {
      averageLoadTime: 1.2, // Estimated
      bounceRate: 0.35, // Estimated
      clickThroughRate: conversionRate / 100,
      shareRate: 0.05 // Estimated
    },
    
    predictions: {
      expectedDailyScans: Math.ceil(totalScans / Math.max(getDaysSinceCreation(qrCode.createdAt), 1)),
      seasonalTrends: {},
      growthRate: calculateGrowthRate(scans),
      churnRisk: calculateChurnRisk(scans)
    }
  };
}

function getTimezoneForCountry(country: string): string {
  // Simplified timezone mapping
  const timezoneMap: Record<string, string> = {
    'United States': 'America/New_York',
    'United Kingdom': 'Europe/London',
    'Germany': 'Europe/Berlin',
    'France': 'Europe/Paris',
    'Spain': 'Europe/Madrid',
    'Japan': 'Asia/Tokyo',
    'Australia': 'Australia/Sydney',
    'Canada': 'America/Toronto',
    'Brazil': 'America/Sao_Paulo',
    'India': 'Asia/Kolkata',
    'China': 'Asia/Shanghai'
  };
  
  return timezoneMap[country] || 'UTC';
}

function getDaysSinceCreation(createdAt: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - createdAt.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateGrowthRate(scans: any[]): number {
  if (scans.length < 2) return 0;
  
  // Calculate weekly growth rate
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const thisWeekScans = scans.filter(scan => new Date(scan.scannedAt) >= lastWeek).length;
  const lastWeekScans = scans.filter(scan => {
    const scanDate = new Date(scan.scannedAt);
    return scanDate >= previousWeek && scanDate < lastWeek;
  }).length;
  
  if (lastWeekScans === 0) return thisWeekScans > 0 ? 100 : 0;
  
  return ((thisWeekScans - lastWeekScans) / lastWeekScans) * 100;
}

function calculateChurnRisk(scans: any[]): number {
  if (scans.length === 0) return 0;
  
  // Calculate based on recent activity
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const recentScans = scans.filter(scan => new Date(scan.scannedAt) >= threeDaysAgo).length;
  
  if (recentScans === 0) return 0.8; // High churn risk if no recent activity
  if (recentScans < 5) return 0.4; // Medium churn risk
  return 0.1; // Low churn risk
}