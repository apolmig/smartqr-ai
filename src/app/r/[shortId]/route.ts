import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { DatabaseService } from '@/lib/db-service';
import { aiEngine, UserContext } from '@/lib/ai-engine';
import { getDeviceType, getBrowserName, getOSName } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { shortId: string } }
) {
  try {
    const { shortId } = params;
    
    // Find the QR code
    const qrCode = await DatabaseService.getQRCode(shortId);

    if (!qrCode || !qrCode.isActive) {
      return NextResponse.redirect(new URL('/404', request.url));
    }

    // Collect analytics data
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || '';
    const forwardedFor = headersList.get('x-forwarded-for') || '';
    const realIp = headersList.get('x-real-ip') || '';
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
    return NextResponse.redirect(targetUrl);

  } catch (error) {
    console.error('QR redirect error:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}

