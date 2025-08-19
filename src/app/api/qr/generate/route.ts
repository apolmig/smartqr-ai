import { NextRequest, NextResponse } from 'next/server';
import { qrGenerator } from '@/lib/qr';
import { DatabaseService } from '@/lib/db-service';

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

    // Try to save to database, but fallback to in-memory if it fails
    let qrCode;
    try {
      qrCode = await DatabaseService.createQRCode(userId, {
        name: qrData.name,
        targetUrl: qrData.targetUrl,
        enableAI: enableAI,
      });
    } catch (dbError) {
      console.warn('Database save failed, using in-memory data:', dbError);
      // Fallback to in-memory QR data
      qrCode = {
        id: qrData.id,
        shortId: qrData.shortId,
        name: qrData.name,
        targetUrl: qrData.targetUrl,
        isActive: true,
        enableAI: enableAI,
        totalScans: 0,
        createdAt: new Date(),
      };
    }

    return NextResponse.json({
      success: true,
      qrCode: {
        ...qrCode,
        qrCodeDataUrl: qrData.qrCodeDataUrl,
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/r/${qrData.shortId}`,
        scanCount: 0,
        createdAt: qrCode.createdAt || new Date().toISOString(),
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
    
    let qrCodes = [];
    try {
      qrCodes = await DatabaseService.getUserQRCodes(userId);
    } catch (dbError) {
      console.warn('Database fetch failed, returning empty array:', dbError);
      qrCodes = []; // Return empty array if database fails
    }

    return NextResponse.json({
      success: true,
      qrCodes: qrCodes.map(qr => ({
        ...qr,
        scanCount: qr.totalScans,
        qrCodeDataUrl: `/api/qr/${qr.id}/image`, // We'll create this endpoint
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/r/${qr.shortId}`,
      }))
    });

  } catch (error) {
    console.error('QR fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QR codes' },
      { status: 500 }
    );
  }
}