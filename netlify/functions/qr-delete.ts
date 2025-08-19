import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { DatabaseService } from '../../src/lib/db-service';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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

    if (!qrCodeId || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'QR code ID and user ID are required' }),
      };
    }

    console.log('Deleting QR code:', qrCodeId, 'for user:', userId);

    await DatabaseService.deleteQRCode(qrCodeId, userId);

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