import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiResponseHelper } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const { shortId, routingResult } = await request.json();

    if (!shortId || !routingResult) {
      return ApiResponseHelper.badRequest('shortId and routingResult are required');
    }

    // Find the QR code
    const qrCode = await prisma.qRCode.findUnique({
      where: { shortId }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Store routing decision for analytics (create a simple log table or use existing scan table)
    // For now, we'll store it as a scan with special metadata
    await prisma.scan.create({
      data: {
        qrCodeId: qrCode.id,
        userAgent: 'ai-routing-decision',
        device: 'ai-system',
        os: 'ai-system',
        browser: 'ai-system',
        userSegment: 'routing_decision',
        additionalData: JSON.stringify({
          routingDecision: {
            originalUrl: qrCode.targetUrl,
            selectedUrl: routingResult.targetUrl,
            matchedRuleId: routingResult.matchedRule?.id,
            matchedRuleName: routingResult.matchedRule?.name,
            confidence: routingResult.confidence,
            reasoning: routingResult.reasoning,
            timestamp: new Date().toISOString()
          }
        })
      }
    });

    return ApiResponseHelper.success({
      message: 'Routing decision recorded'
    });

  } catch (error) {
    console.error('Routing decision recording error:', error);
    return ApiResponseHelper.internalError('Failed to record routing decision');
  }
}