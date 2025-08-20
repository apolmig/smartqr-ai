import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiResponseHelper } from '@/lib/api-response';
import { MarketingContext } from '@/lib/ai-enhanced';

export async function POST(request: NextRequest) {
  try {
    const { shortId, context }: { shortId: string; context: MarketingContext } = await request.json();

    if (!shortId) {
      return ApiResponseHelper.badRequest('shortId is required');
    }

    // Find the QR code
    const qrCode = await prisma.qRCode.findUnique({
      where: { shortId },
      include: { user: true }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Get client IP for analytics
    const clientIP = getClientIP(request);

    // Create scan record with enhanced analytics
    const scan = await prisma.scan.create({
      data: {
        qrCodeId: qrCode.id,
        userAgent: context.userAgent,
        ipAddress: clientIP,
        country: context.country,
        city: context.city,
        device: context.device,
        os: context.os,
        browser: context.browser,
        userSegment: determineUserSegment(context),
        // Store additional context as JSON if needed
        additionalData: JSON.stringify({
          utmSource: context.utmSource,
          utmMedium: context.utmMedium,
          utmCampaign: context.utmCampaign,
          referrer: context.referrer,
          isReturningVisitor: context.isReturningVisitor,
          engagementScore: context.engagementScore,
          timeOfDay: context.timeOfDay,
          dayOfWeek: context.dayOfWeek
        })
      }
    });

    // Update QR code scan count and last scanned
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: {
        totalScans: { increment: 1 },
        lastScanned: new Date()
      }
    });

    return ApiResponseHelper.success({
      scanId: scan.id,
      message: 'Scan recorded successfully'
    });

  } catch (error) {
    console.error('Scan recording error:', error);
    return ApiResponseHelper.internalError('Failed to record scan');
  }
}

function getClientIP(request: NextRequest): string {
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

function determineUserSegment(context: MarketingContext): string {
  // Simple user segmentation logic
  if (context.device === 'mobile' && context.timeOfDay >= 18) {
    return 'mobile_evening';
  }
  
  if (context.device === 'desktop' && context.timeOfDay >= 9 && context.timeOfDay <= 17) {
    return 'business_desktop';
  }
  
  if (context.isReturningVisitor) {
    return 'returning_user';
  }
  
  if (context.utmSource) {
    return `${context.utmSource}_traffic`;
  }
  
  return 'general';
}