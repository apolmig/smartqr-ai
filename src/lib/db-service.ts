import prisma, { getPlanLimits } from './prisma';
import { generateShortId } from './utils';

export class DatabaseService {
  // QR Code operations
  static async createQRCode(userId: string, data: {
    name: string;
    targetUrl: string;
    enableAI?: boolean;
  }) {
    // Check user's plan limits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { qrCodes: true },
    });

    if (!user) throw new Error('User not found');

    const limits = getPlanLimits(user.plan);
    if (limits.qrCodes !== -1 && user.qrCodes.length >= limits.qrCodes) {
      throw new Error('QR code limit reached for your plan');
    }

    const shortId = generateShortId();
    
    return await prisma.qRCode.create({
      data: {
        ...data,
        shortId,
        userId,
        enableAI: data.enableAI && limits.aiFeatures,
      },
    });
  }

  static async getUserQRCodes(userId: string) {
    return await prisma.qRCode.findMany({
      where: { userId },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 10,
        },
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getQRCode(shortId: string) {
    return await prisma.qRCode.findUnique({
      where: { shortId },
      include: {
        variants: {
          where: { isActive: true },
        },
        user: true,
      },
    });
  }

  static async updateQRCode(shortId: string, userId: string, data: {
    name?: string;
    targetUrl?: string;
    isActive?: boolean;
    enableAI?: boolean;
  }) {
    return await prisma.qRCode.updateMany({
      where: { shortId, userId },
      data,
    });
  }

  static async deleteQRCode(shortId: string, userId: string) {
    return await prisma.qRCode.deleteMany({
      where: { shortId, userId },
    });
  }

  // Analytics operations
  static async recordScan(qrCodeId: string, data: {
    variantId?: string;
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    city?: string;
    device?: string;
    os?: string;
    browser?: string;
    userSegment?: string;
  }) {
    // Record the scan
    const scan = await prisma.scan.create({
      data: {
        qrCodeId,
        ...data,
      },
    });

    // Update QR code scan count and last scanned
    await prisma.qRCode.update({
      where: { id: qrCodeId },
      data: {
        totalScans: { increment: 1 },
        lastScanned: new Date(),
      },
    });

    return scan;
  }

  static async getQRAnalytics(qrCodeId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const scans = await prisma.scan.findMany({
      where: {
        qrCodeId,
        scannedAt: { gte: since },
      },
      orderBy: { scannedAt: 'desc' },
    });

    // Aggregate analytics
    const analytics = {
      totalScans: scans.length,
      uniqueScans: new Set(scans.map(s => s.ipAddress)).size,
      devices: this.aggregateField(scans, 'device'),
      browsers: this.aggregateField(scans, 'browser'),
      countries: this.aggregateField(scans, 'country'),
      dailyScans: this.aggregateByDay(scans, days),
    };

    return analytics;
  }

  static async getUserAnalytics(userId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        qrCodes: {
          include: {
            scans: {
              where: { scannedAt: { gte: since } },
            },
          },
        },
      },
    });

    if (!user) return null;

    const allScans = user.qrCodes.flatMap(qr => qr.scans);
    
    return {
      totalQRCodes: user.qrCodes.length,
      activeQRCodes: user.qrCodes.filter(qr => qr.isActive).length,
      totalScans: allScans.length,
      uniqueScans: new Set(allScans.map(s => s.ipAddress)).size,
      topQRCodes: user.qrCodes
        .map(qr => ({
          id: qr.id,
          name: qr.name,
          shortId: qr.shortId,
          scans: qr.scans.length,
        }))
        .sort((a, b) => b.scans - a.scans)
        .slice(0, 5),
    };
  }

  // QR Variants for A/B testing
  static async createQRVariant(qrCodeId: string, data: {
    name: string;
    targetUrl: string;
    weight?: number;
    conditions?: any;
  }) {
    return await prisma.qRVariant.create({
      data: {
        ...data,
        qrCodeId,
        conditions: data.conditions ? JSON.stringify(data.conditions) : null,
      },
    });
  }

  static async getActiveVariant(qrCodeId: string, context?: any) {
    const variants = await prisma.qRVariant.findMany({
      where: { qrCodeId, isActive: true },
    });

    if (variants.length === 0) return null;
    if (variants.length === 1) return variants[0];

    // Simple weighted selection for A/B testing
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const variant of variants) {
      random -= variant.weight;
      if (random <= 0) {
        return variant;
      }
    }

    return variants[0];
  }

  // Helper methods
  private static aggregateField(scans: any[], field: string) {
    const counts: Record<string, number> = {};
    scans.forEach(scan => {
      const value = scan[field] || 'Unknown';
      counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private static aggregateByDay(scans: any[], days: number) {
    const dailyCounts: Record<string, number> = {};
    
    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts[dateStr] = 0;
    }

    // Count scans per day
    scans.forEach(scan => {
      const dateStr = scan.scannedAt.toISOString().split('T')[0];
      if (dailyCounts.hasOwnProperty(dateStr)) {
        dailyCounts[dateStr]++;
      }
    });

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}