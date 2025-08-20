import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiResponseHelper } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { shortId: string } }
) {
  try {
    const { shortId } = params;

    // Find QR code with routing rules and variants
    const qrCode = await prisma.qRCode.findUnique({
      where: { shortId },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { weight: 'desc' }
        },
        user: {
          select: {
            id: true,
            plan: true
          }
        }
      }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Convert stored routing rules from JSON if they exist
    let routingRules = [];
    if (qrCode.qrOptions) {
      try {
        const options = JSON.parse(qrCode.qrOptions);
        routingRules = options.routingRules || [];
      } catch (error) {
        console.error('Failed to parse QR options:', error);
      }
    }

    // Build response with enhanced data
    const response = {
      id: qrCode.id,
      shortId: qrCode.shortId,
      name: qrCode.name,
      targetUrl: qrCode.targetUrl,
      isActive: qrCode.isActive,
      enableAI: qrCode.enableAI,
      totalScans: qrCode.totalScans,
      routingRules,
      variants: qrCode.variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        targetUrl: variant.targetUrl,
        weight: variant.weight,
        conditions: variant.conditions ? JSON.parse(variant.conditions) : null
      })),
      userPlan: qrCode.user.plan,
      createdAt: qrCode.createdAt
    };

    return ApiResponseHelper.success({
      qrCode: response
    });

  } catch (error) {
    console.error('QR resolve error:', error);
    return ApiResponseHelper.internalError('Failed to resolve QR code');
  }
}