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

    // Try to save to database, but fallback to in-memory if it fails
    let qrCode;
    try {
      console.log('Saving QR code to database...');
      
      // Ensure user exists first
      const finalUserId = userId || 'anonymous';
      await DatabaseService.ensureUser(finalUserId, `User ${finalUserId}`);
      
      const dbQRCode = await DatabaseService.createQRCode(finalUserId, {
        name: qrData.name,
        targetUrl: qrData.targetUrl,
        enableAI: enableAI,
      });
      console.log('QR code saved to database:', dbQRCode.id);
      
      // Use database QR code but keep generated QR image
      qrCode = {
        id: dbQRCode.id,
        shortId: dbQRCode.shortId,
        name: dbQRCode.name,
        targetUrl: dbQRCode.targetUrl,
        isActive: dbQRCode.isActive,
        enableAI: dbQRCode.enableAI,
        totalScans: dbQRCode.totalScans,
        createdAt: dbQRCode.createdAt,
        qrCodeDataUrl: qrData.qrCodeDataUrl, // Use generated QR image
      };
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

    console.log('Returning success response');
    return NextResponse.json({
      success: true,
      qrCode: {
        ...qrCode,
        qrCodeDataUrl: qrCode.qrCodeDataUrl || qrData.qrCodeDataUrl,
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/r/${qrCode.shortId}`,
        scanCount: qrCode.totalScans || 0,
        createdAt: qrCode.createdAt instanceof Date ? qrCode.createdAt.toISOString() : qrCode.createdAt,
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
      qrCodes: await Promise.all(qrCodes.map(async (qr) => {
        // Regenerate QR code image for each QR
        const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/r/${qr.shortId}`;
        let qrCodeDataUrl = '';
        
        try {
          const qrData = await qrGenerator.generateQRCode(qr.name, redirectUrl);
          qrCodeDataUrl = qrData.qrCodeDataUrl;
        } catch (error) {
          console.error('Failed to regenerate QR for', qr.shortId, error);
        }
        
        return {
          ...qr,
          scanCount: qr.totalScans,
          qrCodeDataUrl,
          redirectUrl,
        };
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