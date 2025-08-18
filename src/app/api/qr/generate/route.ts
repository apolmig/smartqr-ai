import { NextRequest, NextResponse } from 'next/server';
import { qrGenerator } from '@/lib/qr';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, targetUrl, enableAI = false } = body;
    
    // Get user ID from request (in real app would be from session)
    const userId = body.userId || 'anonymous';

    // Validation
    if (!name || !targetUrl) {
      return NextResponse.json(
        { error: 'Name and target URL are required' },
        { status: 400 }
      );
    }

    if (!qrGenerator.validateUrl(targetUrl)) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // TODO: Check user limits based on plan
    // For now, allow unlimited for development

    // Format URL
    const formattedUrl = qrGenerator.formatUrl(targetUrl);

    // Generate QR code
    const qrData = await qrGenerator.generateQRCode(name, formattedUrl);

    // Save to database
    const qrCode = await db.createQRCode({
      id: qrData.id,
      shortId: qrData.shortId,
      name: qrData.name,
      targetUrl: qrData.targetUrl,
      userId: userId,
      isActive: true,
      enableAI: enableAI,
      totalScans: 0,
    });

    return NextResponse.json({
      success: true,
      qrCode: {
        ...qrCode,
        qrCodeDataUrl: qrData.qrCodeDataUrl,
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/r/${qrCode.shortId}`,
      }
    });

  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'anonymous';
    const qrCodes = await db.findQRCodesByUserId(userId);
    
    // Add scan counts
    const qrCodesWithCounts = await Promise.all(
      qrCodes.map(async (qr) => ({
        ...qr,
        scanCount: await db.getScanCount(qr.id),
      }))
    );

    return NextResponse.json({
      success: true,
      qrCodes: qrCodesWithCounts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    });

  } catch (error) {
    console.error('QR fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QR codes' },
      { status: 500 }
    );
  }
}