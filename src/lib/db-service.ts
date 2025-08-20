import prisma, { getPlanLimits } from './prisma';
import { generateShortId } from './utils';

export class DatabaseService {
  // User operations
  static async ensureUser(userId: string, name: string, email?: string) {
    try {
      // For anonymous users, find or create by email
      const userEmail = email || `${userId}@demo.local`;
      
      // Try to find existing user by email first
      let existingUser = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (existingUser) {
        return existingUser;
      }

      // Create new user if not found (let Prisma generate the ID)
      return await prisma.user.create({
        data: {
          name,
          email: userEmail,
          plan: 'FREE',
        },
      });
    } catch (error) {
      console.warn('Failed to ensure user, using fallback:', error);
      // For demo purposes, return a mock user if database fails
      return {
        id: 'demo-user',
        email: userEmail,
        name,
        plan: 'FREE',
        qrCodes: []
      };
    }
  }

  // QR Code operations  
  static async createQRCode(userIdentifier: string, data: {
    name: string;
    targetUrl: string;
    enableAI?: boolean;
    qrStyle?: string;
    qrColor?: string;
    qrSize?: number;
    qrOptions?: any;
  }) {
    try {
      // Ensure user exists first
      const user = await this.ensureUser(userIdentifier, `User ${userIdentifier}`);
      
      // Check user's plan limits
      const userWithQRs = await prisma.user.findUnique({
        where: { id: user.id },
        include: { qrCodes: true },
      });

      if (!userWithQRs) throw new Error('User not found after creation');

      const limits = getPlanLimits(userWithQRs.plan);
      if (limits.qrCodes !== -1 && userWithQRs.qrCodes.length >= limits.qrCodes) {
        throw new Error('QR code limit reached for your plan');
      }

      // Generate unique short ID
      let shortId;
      let attempts = 0;
      do {
        shortId = generateShortId();
        const existing = await prisma.qRCode.findUnique({
          where: { shortId },
        });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new Error('Failed to generate unique short ID');
      }

      // Create QR code
      return await prisma.qRCode.create({
        data: {
          name: data.name,
          shortId,
          targetUrl: data.targetUrl,
          enableAI: data.enableAI || false,
          qrStyle: data.qrStyle || 'classic',
          qrColor: data.qrColor || '#000000',
          qrSize: data.qrSize || 256,
          qrOptions: data.qrOptions ? JSON.stringify(data.qrOptions) : null,
          userId: user.id,
        },
        include: {
          scans: true,
        },
      });
    } catch (error) {
      console.error('Error creating QR code:', error);
      throw error;
    }
  }

  static async getUserQRCodes(userIdentifier: string) {
    try {
      console.log('getUserQRCodes called with identifier:', userIdentifier);
      
      // First try to find user by email (for anonymous users)
      const userEmail = `${userIdentifier}@demo.local`;
      console.log('Looking for user with email:', userEmail);
      
      let user = await prisma.user.findUnique({
        where: { email: userEmail },
      });
      console.log('User found by email:', user ? user.id : 'none');

      // If not found by email, try by ID
      if (!user) {
        console.log('Trying to find user by ID:', userIdentifier);
        user = await prisma.user.findUnique({
          where: { id: userIdentifier },
        });
        console.log('User found by ID:', user ? user.id : 'none');
      }

      if (!user) {
        console.log(`No user found for identifier: ${userIdentifier}`);
        return [];
      }

      console.log('Found user:', user.id, 'email:', user.email);
      
      const qrCodes = await prisma.qRCode.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      
      console.log('QR codes found for user:', qrCodes.length);
      return qrCodes;
    } catch (error) {
      console.error('Error fetching user QR codes:', error);
      return [];
    }
  }

  static async deleteQRCode(qrCodeId: string, userId: string) {
    // Verify the QR code belongs to the user before deleting
    const qrCode = await prisma.qRCode.findFirst({
      where: {
        id: qrCodeId,
        userId: userId,
      },
    });

    if (!qrCode) {
      throw new Error('QR Code not found or access denied');
    }

    // Delete the QR code and all associated data
    await prisma.qRCode.delete({
      where: { id: qrCodeId },
    });

    return { success: true, message: 'QR Code deleted successfully' };
  }

  static async getQRByShortId(shortId: string) {
    return await prisma.qRCode.findUnique({
      where: { shortId },
      include: {
        variants: {
          where: { isActive: true },
        },
      },
    });
  }

  static async incrementScanCount(qrCodeId: string, scanData?: any) {
    // Update the QR code scan count
    const updatedQR = await prisma.qRCode.update({
      where: { id: qrCodeId },
      data: {
        totalScans: { increment: 1 },
        lastScanned: new Date(),
      },
    });

    // Create scan record if scan data is provided
    if (scanData) {
      await prisma.scan.create({
        data: {
          qrCodeId,
          ...scanData,
        },
      });
    }

    return updatedQR;
  }

  // Additional methods for redirect functionality
  static async getQRCode(shortId: string) {
    return await this.getQRByShortId(shortId);
  }

  static async getActiveVariant(qrCodeId: string) {
    const variants = await prisma.qRVariant.findMany({
      where: {
        qrCodeId,
        isActive: true,
      },
      orderBy: { weight: 'desc' },
    });
    
    return variants.length > 0 ? variants[0] : null;
  }

  static async recordScan(qrCodeId: string, scanData: any) {
    try {
      // Create scan record
      await prisma.scan.create({
        data: {
          qrCodeId,
          userAgent: scanData.userAgent,
          ipAddress: scanData.ipAddress,
          country: scanData.country,
          city: scanData.city,
          device: scanData.device,
          os: scanData.os,
          browser: scanData.browser,
          referrer: scanData.referrer,
          additionalData: scanData.additionalData ? JSON.stringify(scanData.additionalData) : null,
        },
      });

      // Update QR code scan count
      await this.incrementScanCount(qrCodeId);
    } catch (error) {
      console.error('Error recording scan:', error);
      // Don't throw error to avoid breaking redirects
    }
  }
}