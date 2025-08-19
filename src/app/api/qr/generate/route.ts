import { NextRequest, NextResponse } from 'next/server';
import { qrGenerator } from '@/lib/qr';
import { DatabaseService } from '@/lib/db-service';

export async function POST(request: NextRequest) {
  try {
    console.log('QR generation API called');
    const body = await request.json();
    console.log('Request body:', body);
    
    const { name, targetUrl, enableAI = false, userId } = body;

    // Validation
    if (!name || !targetUrl) {
      console.log('Validation failed: missing name or targetUrl');
      return NextResponse.json(
        { error: 'Name and target URL are required' },
        { status: 400 }
      );
    }

    console.log('Validating URL:', targetUrl);
    if (!qrGenerator.validateUrl(targetUrl)) {
      console.log('URL validation failed');
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Format URL
    const formattedUrl = qrGenerator.formatUrl(targetUrl);
    console.log('Formatted URL:', formattedUrl);

    // Generate QR code
    console.log('Generating QR code...');
    const qrData = await qrGenerator.generateQRCode(name, formattedUrl);
    console.log('QR data generated:', { ...qrData, qrCodeDataUrl: '[DATA_URL]' });

    // Create simple QR code object (skip database for now)
    const qrCode = {
      id: qrData.id,
      shortId: qrData.shortId,
      name: qrData.name,
      targetUrl: qrData.targetUrl,
      isActive: true,
      enableAI: enableAI,
      totalScans: 0,
      createdAt: new Date(),
    };

    console.log('Returning success response');
    return NextResponse.json({
      success: true,
      qrCode: {
        ...qrCode,
        qrCodeDataUrl: qrData.qrCodeDataUrl,
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/r/${qrData.shortId}`,
        scanCount: 0,
        createdAt: qrCode.createdAt.toISOString(),
      }
    });

  } catch (error) {
    console.error('QR generation error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: `Failed to generate QR code: ${error.message}` },
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