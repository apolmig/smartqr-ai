import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedDatabaseService } from '../../src/lib/enhanced-db-service';
import { qrGenerator } from '../../src/lib/qr';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Debug environment variables
  const envDebug = {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    DATABASE_HOST: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'none',
    DATABASE_SEARCH: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).search : 'none',
    URL: process.env.URL ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  };
  console.log('Environment check:', envDebug);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  // Handle GET - fetch user's QR codes
  if (event.httpMethod === 'GET') {
    try {
      const userId = event.queryStringParameters?.userId || 'anonymous';
      
      let qrCodes = [];
      try {
        console.log('Attempting to fetch QR codes for user:', userId);
        qrCodes = await EnhancedDatabaseService.getUserQRCodes(userId);
        console.log('Fetched QR codes:', qrCodes.length);
      } catch (dbError) {
        console.warn('Database fetch failed, returning empty array:', dbError);
        console.error('Full error details:', dbError.message, dbError.stack);
        qrCodes = []; // Return empty array if database fails
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          debug: envDebug,
          qrCodes: await Promise.all(qrCodes.map(async (qr) => {
            // Regenerate QR code image for each QR
            const redirectUrl = `${process.env.URL || 'https://smartqr.es'}/r/${qr.shortId}`;
            let qrCodeDataUrl = '';
            
            try {
              // Use stored QR options for regeneration
              let storedOptions = null;
              if (qr.qrOptions) {
                try {
                  storedOptions = JSON.parse(qr.qrOptions);
                } catch (e) {
                  console.error('Failed to parse stored QR options:', e);
                }
              }
              
              // Build options from stored data
              const regenerationOptions = {
                size: qr.qrSize || 256,
                color: {
                  dark: qr.qrColor || '#000000',
                  light: '#FFFFFF'
                },
                ...(storedOptions || {})
              };
              
              console.log('Regenerating QR with stored options for target URL:', qr.targetUrl);
              // FIX: Use actual targetUrl instead of redirectUrl so downloaded QR points directly to target
              const qrData = await qrGenerator.generateQRCode(qr.name, qr.targetUrl, regenerationOptions);
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
        }),
      };

    } catch (error) {
      console.error('QR fetch error:', error);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Failed to fetch QR codes' }),
      };
    }
  }

  // Handle POST - create new QR code
  if (event.httpMethod === 'POST') {
    try {
      console.log('QR generation API called');
      
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Request body is required' }),
        };
      }

      const body = JSON.parse(event.body);
      console.log('Request body:', body);
      
      const { name, targetUrl, enableAI = false, userId, qrOptions } = body;

      // Validation
      if (!name || !targetUrl) {
        console.log('Validation failed: missing name or targetUrl');
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Name and target URL are required' }),
        };
      }

      console.log('Validating URL:', targetUrl);
      if (!qrGenerator.validateUrl(targetUrl)) {
        console.log('URL validation failed');
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Invalid URL format' }),
        };
      }

      // Format URL
      const formattedUrl = qrGenerator.formatUrl(targetUrl);
      console.log('Formatted URL:', formattedUrl);

      // Generate QR code
      console.log('Generating QR code...', qrOptions ? 'with custom styling' : 'with default styling');
      const qrData = await qrGenerator.generateQRCode(name, formattedUrl, qrOptions);
      console.log('QR data generated:', { ...qrData, qrCodeDataUrl: '[DATA_URL]' });

      // Try to save to database, but fallback to in-memory if it fails
      let qrCode;
      try {
        console.log('Saving QR code to database...');
        
        // Create QR code using enhanced service
        const finalUserId = userId || 'anonymous';
        
        const dbQRCode = await EnhancedDatabaseService.createQRCode(finalUserId, {
          name: qrData.name,
          targetUrl: qrData.targetUrl,
          enableAI: enableAI,
          qrStyle: qrOptions?.style ? 'custom' : 'classic',
          qrColor: qrOptions?.color?.dark || qrOptions?.style?.dotsColor || '#000000',
          qrSize: qrOptions?.size || 256,
          qrOptions: qrOptions,
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
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          qrCode: {
            ...qrCode,
            qrCodeDataUrl: qrCode.qrCodeDataUrl || qrData.qrCodeDataUrl,
            redirectUrl: `${process.env.URL || 'https://smartqr.es'}/r/${qrCode.shortId}`,
            scanCount: qrCode.totalScans || 0,
            createdAt: qrCode.createdAt instanceof Date ? qrCode.createdAt.toISOString() : qrCode.createdAt,
          },
          // Enhanced debugging information
          debug: {
            consistencyVerified: qrCode.consistencyVerified,
            warnings: qrCode.warnings || [],
            timestamp: new Date().toISOString()
          }
        }),
      };

    } catch (error) {
      console.error('QR generation error:', error);
      console.error('Error stack:', error.stack);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: `Failed to generate QR code: ${error.message}` }),
      };
    }
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};// Force redeploy Sat, Aug 23, 2025 12:37:34 AM
console.log('Environment updated:', new Date().toISOString());
