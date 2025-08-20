import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    // Find session
    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { 
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            emailVerified: true,
            isActive: true,
            lastLogin: true,
          }
        }
      },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Update last used timestamp
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastUsed: new Date() },
    });

    return NextResponse.json({
      success: true,
      user: session.user,
      session: {
        expiresAt: session.expiresAt,
        lastUsed: new Date(),
      },
    });

  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    // Invalidate session
    await prisma.userSession.updateMany({
      where: { token },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}