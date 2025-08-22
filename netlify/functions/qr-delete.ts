import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedDatabaseService } from '../../src/lib/enhanced-db-service';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Debug environment variables
  console.log('QR Delete environment check:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    DATABASE_HOST: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'none',
    DATABASE_SEARCH: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).search : 'none',
    timestamp: new Date().toISOString()
  });

  console.log('QR Delete function called:', {
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
    path: event.path,
    headers: event.headers
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  // Only handle DELETE requests
  if (event.httpMethod !== 'DELETE') {
    console.log('Invalid method received:', event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const qrCodeId = event.queryStringParameters?.id;
    const userId = event.queryStringParameters?.userId;

    console.log('Extracted parameters:', { qrCodeId, userId });

    if (!qrCodeId || !userId) {
      console.log('Missing required parameters');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'QR code ID and user ID are required' }),
      };
    }

    console.log('Attempting to delete QR code:', qrCodeId, 'for user:', userId);

    await EnhancedDatabaseService.deleteQRCode(qrCodeId, userId);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'QR code deleted successfully'
      }),
    };

  } catch (error: any) {
    console.error('QR deletion error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message || 'Failed to delete QR code' }),
    };
  }
};