import { NextRequest, NextResponse } from 'next/server';
import { SessionCleanup } from '@/lib/session-cleanup';
import { ApiResponseHelper } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    // Simple API key check (in production, use proper admin authentication)
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return ApiResponseHelper.unauthorized('Invalid admin credentials');
    }

    const result = await SessionCleanup.cleanupExpiredSessions();
    const stats = await SessionCleanup.getSessionStats();

    return ApiResponseHelper.success({
      cleanup: result,
      stats,
      timestamp: new Date().toISOString(),
    }, 'Session cleanup completed successfully');

  } catch (error) {
    console.error('Admin session cleanup error:', error);
    return ApiResponseHelper.internalError('Session cleanup failed');
  }
}

export async function GET(request: NextRequest) {
  try {
    // Simple API key check (in production, use proper admin authentication)
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return ApiResponseHelper.unauthorized('Invalid admin credentials');
    }

    const stats = await SessionCleanup.getSessionStats();

    return ApiResponseHelper.success({
      stats,
      timestamp: new Date().toISOString(),
    }, 'Session statistics retrieved successfully');

  } catch (error) {
    console.error('Admin session stats error:', error);
    return ApiResponseHelper.internalError('Failed to retrieve session statistics');
  }
}