import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // In our memory DB, we'll need to find by ID
    // For now, we'll return a basic response
    return NextResponse.json({
      success: true,
      message: 'QR code details endpoint'
    });
  } catch (error) {
    console.error('Failed to fetch QR code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QR code' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const updatedQR = await db.updateQRCode(id, body);
    
    if (!updatedQR) {
      return NextResponse.json(
        { error: 'QR code not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      qrCode: updatedQR
    });
  } catch (error) {
    console.error('Failed to update QR code:', error);
    return NextResponse.json(
      { error: 'Failed to update QR code' },
      { status: 500 }
    );
  }
}