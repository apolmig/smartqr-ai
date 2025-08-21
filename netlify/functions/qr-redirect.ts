import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedDatabaseService } from '../../src/lib/enhanced-db-service';
import { aiEngine, UserContext } from '../../src/lib/ai-engine';
import { getDeviceType, getBrowserName, getOSName } from '../../src/lib/utils';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Debug environment variables
  console.log('Environment check:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    URL: process.env.URL ? 'SET' : 'NOT SET'
  });

  console.log('QR redirect function called:', {
    path: event.path,
    method: event.httpMethod,
    queryParams: event.queryStringParameters
  });

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Extract shortId from path parameter (new routing) or query parameter (fallback)
    const pathShortId = event.path.split('/').pop();
    const queryShortId = event.queryStringParameters?.shortId;
    const shortId = pathShortId && pathShortId !== 'qr-redirect' ? pathShortId : queryShortId;
    console.log('Extracted shortId from path:', pathShortId, 'from query:', queryShortId, 'final:', shortId);
    
    if (!shortId) {
      console.log('No shortId found, redirecting to lander');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://smartqr.es'}/lander`,
        },
      };
    }

    // Find the QR code using enhanced persistence solution
    console.log('Looking up QR code with enhanced persistence, shortId:', shortId);
    const qrCode = await EnhancedDatabaseService.getQRCode(shortId);
    console.log('Found QR code:', qrCode ? { 
      id: qrCode.id, 
      name: qrCode.name, 
      targetUrl: qrCode.targetUrl, 
      isActive: qrCode.isActive,
      variants: qrCode.variants?.length || 0 
    } : 'null');

    if (!qrCode || !qrCode.isActive) {
      console.log('QR code not found or inactive, redirecting to lander');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://smartqr.es'}/lander`,
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

    if (qrCode.enableAI && qrCode.variants && qrCode.variants.length > 0) {
      // Check for active variants (A/B testing) - use first active variant for now
      selectedVariant = qrCode.variants.find(v => v.isActive);
      
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

    // Record the scan - Note: This functionality will need to be added to neonPersistenceSolution
    try {
      console.log('Recording scan for QR:', qrCode.id);
      // For now, we'll skip scan recording to focus on core persistence issue
      // TODO: Implement scan recording in neonPersistenceSolution
    } catch (scanError) {
      console.warn('Failed to record scan:', scanError);
      // Don't fail the redirect if scan recording fails
    }

    // Validate and format target URL
    let validatedUrl;
    try {
      // Add protocol if missing
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        validatedUrl = `https://${targetUrl}`;
      } else {
        validatedUrl = targetUrl;
      }
      
      // Validate URL format and protocol
      const urlObject = new URL(validatedUrl);
      if (!['http:', 'https:'].includes(urlObject.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      console.error('Invalid target URL:', targetUrl, error);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://smartqr.es'}/lander`,
        },
      };
    }

    // Redirect to target URL
    console.log('Redirecting to target URL:', validatedUrl);
    return {
      statusCode: 302,
      headers: {
        Location: validatedUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    };

  } catch (error) {
    console.error('QR redirect error:', error);
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL || 'https://smartqr.es'}/lander`,
      },
    };
  }
};