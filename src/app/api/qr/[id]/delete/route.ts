import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('Development DELETE API called:', {
      qrCodeId: id,
      userId,
      method: request.method,
      url: request.url
    });

    if (!userId) {
      console.log('Missing userId parameter');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('Attempting to delete QR code:', id, 'for user:', userId);

    await DatabaseService.deleteQRCode(id, userId);

    return NextResponse.json({
      success: true,
      message: 'QR code deleted successfully'
    });

  } catch (error: any) {
    console.error('QR deletion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete QR code' },
      { status: 500 }
    );
  }
}