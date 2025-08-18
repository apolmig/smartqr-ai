import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { DatabaseService } from '../../src/lib/db-service';
import { aiEngine, UserContext } from '../../src/lib/ai-engine';
import { getDeviceType, getBrowserName, getOSName } from '../../src/lib/utils';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const shortId = event.queryStringParameters?.shortId;
    
    if (!shortId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing shortId parameter' }),
      };
    }

    // Find the QR code
    const qrCode = await DatabaseService.getQRCode(shortId);

    if (!qrCode || !qrCode.isActive) {
      return {
        statusCode: 302,
        headers: {
          Location: 'https://smartqr.ai/404',
        },
      };
    }

    // Collect analytics data
    const userAgent = event.headers['user-agent'] || '';
    const forwardedFor = event.headers['x-forwarded-for'] || '';
    const realIp = event.headers['x-real-ip'] || '';
    const ipAddress = forwardedFor.split(',')[0] || realIp || 'unknown';

    // Detect device type, OS, and browser using utils
    const device = getDeviceType(userAgent);
    const os = getOSName(userAgent);
    const browser = getBrowserName(userAgent);

    // Determine target URL using AI Engine or A/B testing
    let targetUrl = qrCode.targetUrl;
    let selectedVariant = null;

    if (qrCode.enableAI && qrCode.variants.length > 0) {
      // Check for active variants (A/B testing)
      selectedVariant = await DatabaseService.getActiveVariant(qrCode.id);
      
      if (selectedVariant) {
        // Create user context for AI decision
        const now = new Date();
        const userContext: UserContext = {
          device,
          os,
          browser,
          timeOfDay: now.getHours(),
          dayOfWeek: now.getDay(),
          userAgent,
          ipAddress,
        };

        // Parse conditions if they exist
        let conditions = null;
        if (selectedVariant.conditions) {
          try {
            conditions = JSON.parse(selectedVariant.conditions);
          } catch (e) {
            console.error('Failed to parse variant conditions:', e);
          }
        }

        // If conditions match or no conditions, use this variant
        if (!conditions || aiEngine.evaluateConditions(conditions, userContext)) {
          targetUrl = selectedVariant.targetUrl;
        }
      }
    }

    // Record the scan
    await DatabaseService.recordScan(qrCode.id, {
      variantId: selectedVariant?.id,
      userAgent,
      ipAddress: ipAddress.substring(0, 45), // Limit IP length
      device,
      os,
      browser,
    });

    // Redirect to target URL
    return {
      statusCode: 302,
      headers: {
        Location: targetUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    };

  } catch (error) {
    console.error('QR redirect error:', error);
    return {
      statusCode: 302,
      headers: {
        Location: 'https://smartqr.ai/error',
      },
    };
  }
};