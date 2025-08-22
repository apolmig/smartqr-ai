// Enhanced Database Service with Neon Persistence Solution
// Solves critical persistence issues in serverless environment

import { writeClient, readClient, withRetry, verifyConsistency } from './neon-optimized-client';
import { generateShortId } from './utils';
import { getPlanLimits } from './prisma';

export class EnhancedDatabaseService {
  
  // User operations with dual-client approach
  static async ensureUser(userId: string, name: string, email?: string) {
    const userEmail = email || `${userId}@demo.local`;
    console.log(`🔍 ensureUser called: userId=${userId}, email=${userEmail}`);
    
    try {
      // First, try to find existing user using read client
      const existingUser = await withRetry(async () => {
        return await readClient.user.findUnique({
          where: { email: userEmail },
        });
      }, `find-user-${userId}`);

      if (existingUser) {
        console.log(`✅ Found existing user: ${existingUser.id}`);
        return existingUser;
      }

      // Create new user using write client
      console.log(`🔨 Creating new user: ${userEmail}`);
      const newUser = await withRetry(async () => {
        return await writeClient.user.create({
          data: {
            name,
            email: userEmail,
            plan: 'FREE',
          },
        });
      }, `create-user-${userId}`);

      // Verify consistency of user creation
      const verifiedUser = await verifyConsistency(
        newUser,
        () => readClient.user.findUnique({ where: { email: userEmail } }),
        `user-creation-${userId}`
      );

      console.log(`✅ User created and verified: ${verifiedUser.id}`);
      return verifiedUser;

    } catch (error: any) {
      console.error(`❌ Failed to ensure user ${userId}:`, error.message);
      throw new Error(`User operation failed: ${error.message}`);
    }
  }

  // Enhanced QR Code creation with full consistency verification
  static async createQRCode(userIdentifier: string, data: {
    name: string;
    targetUrl: string;
    enableAI?: boolean;
    qrStyle?: string;
    qrColor?: string;
    qrSize?: number;
    qrOptions?: any;
  }) {
    console.log(`🔍 createQRCode called: user=${userIdentifier}, name=${data.name}`);
    
    try {
      // Step 1: Ensure user exists
      const user = await this.ensureUser(userIdentifier, `User ${userIdentifier}`);
      console.log(`✅ User ensured: ${user.id}`);

      // Step 2: Check user's plan limits
      const userWithQRs = await withRetry(async () => {
        return await readClient.user.findUnique({
          where: { id: user.id },
          include: { qrCodes: true },
        });
      }, `check-user-limits-${user.id}`);

      if (!userWithQRs) {
        throw new Error('User not found after creation');
      }

      const limits = getPlanLimits(userWithQRs.plan);
      if (limits.qrCodes !== -1 && userWithQRs.qrCodes.length >= limits.qrCodes) {
        throw new Error('QR code limit reached for your plan');
      }

      // Step 3: Generate unique short ID with verification
      let shortId: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        shortId = generateShortId();
        const existing = await withRetry(async () => {
          return await readClient.qRCode.findUnique({
            where: { shortId },
          });
        }, `check-shortid-${shortId}`);

        if (!existing) break;
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique short ID');
      }

      console.log(`🔨 Creating QR with shortId: ${shortId}`);

      // Step 4: Create QR code using write client with transaction
      const newQR = await withRetry(async () => {
        return await writeClient.$transaction(async (tx) => {
          // Create the QR code
          const qrCode = await tx.qRCode.create({
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
          });

          // Verify within transaction that QR was created
          const verification = await tx.qRCode.findUnique({
            where: { shortId },
          });

          if (!verification) {
            throw new Error('QR verification failed within transaction');
          }

          console.log(`✅ QR created in transaction: ${qrCode.id}`);
          return qrCode;
        });
      }, `create-qr-${shortId}`);

      // Step 5: Multi-level consistency verification
      console.log(`🔍 Starting multi-level consistency verification for ${shortId}`);

      // Verification 1: Read using write client
      const writeClientVerification = await withRetry(async () => {
        return await writeClient.qRCode.findUnique({
          where: { shortId },
        });
      }, `write-client-verification-${shortId}`);

      if (!writeClientVerification) {
        console.error(`❌ Write client verification failed for ${shortId}`);
        throw new Error('Write client consistency check failed');
      }

      // Verification 2: Read using read client with retry
      const readClientVerification = await verifyConsistency(
        newQR,
        () => readClient.qRCode.findUnique({ where: { shortId } }),
        `qr-creation-${shortId}`
      );

      // Verification 3: Cross-client consistency check
      if (writeClientVerification.id !== readClientVerification?.id) {
        console.warn(`⚠️  Cross-client consistency mismatch for ${shortId}`);
        // Wait and retry one more time
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const finalVerification = await readClient.qRCode.findUnique({
          where: { shortId },
        });
        
        if (!finalVerification) {
          console.error(`❌ Final verification failed for ${shortId}`);
          throw new Error('Cross-client consistency verification failed');
        }
      }

      console.log(`✅ QR creation fully verified: ${shortId}`);
      return {
        ...newQR,
        scans: [], // Add empty scans array for compatibility
      };

    } catch (error: any) {
      console.error(`❌ QR creation failed:`, error.message);
      throw error;
    }
  }

  // Enhanced QR fetching with intelligent retry and dual-client verification
  static async getUserQRCodes(userIdentifier: string) {
    console.log(`🔍 getUserQRCodes called: ${userIdentifier}`);
    
    try {
      // Ensure user exists first
      const user = await this.ensureUser(userIdentifier, `User ${userIdentifier}`);
      console.log(`✅ User ensured for QR fetch: ${user.id}`);

      // Multi-strategy QR fetching
      let qrCodes: any[] = [];
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts && qrCodes.length === 0) {
        attempts++;
        console.log(`🔍 QR fetch attempt ${attempts}/${maxAttempts}`);

        try {
          // Strategy 1: Use read client
          qrCodes = await withRetry(async () => {
            return await readClient.qRCode.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
            });
          }, `qr-fetch-read-${attempts}`);

          if (qrCodes.length > 0) {
            console.log(`✅ Found ${qrCodes.length} QRs using read client on attempt ${attempts}`);
            break;
          }

          // Strategy 2: Use write client if read client returns empty
          console.log(`⚠️  Read client returned empty, trying write client...`);
          qrCodes = await withRetry(async () => {
            return await writeClient.qRCode.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
            });
          }, `qr-fetch-write-${attempts}`);

          if (qrCodes.length > 0) {
            console.log(`✅ Found ${qrCodes.length} QRs using write client on attempt ${attempts}`);
            break;
          }

          // Strategy 3: Direct user lookup with QRs included
          console.log(`⚠️  Both clients returned empty, trying user lookup...`);
          const userWithQRs = await withRetry(async () => {
            return await readClient.user.findUnique({
              where: { id: user.id },
              include: {
                qrCodes: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            });
          }, `user-with-qrs-${attempts}`);

          if (userWithQRs?.qrCodes?.length) {
            qrCodes = userWithQRs.qrCodes;
            console.log(`✅ Found ${qrCodes.length} QRs using user lookup on attempt ${attempts}`);
            break;
          }

          // Wait before next attempt
          if (attempts < maxAttempts) {
            const delay = 200 * attempts; // Increasing delay
            console.log(`⏳ Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (fetchError: any) {
          console.error(`❌ QR fetch attempt ${attempts} failed:`, fetchError.message);
          if (attempts === maxAttempts) {
            throw fetchError;
          }
          await new Promise(resolve => setTimeout(resolve, 200 * attempts));
        }
      }

      // Debug logging if still empty
      if (qrCodes.length === 0) {
        console.log(`🔍 No QRs found after ${maxAttempts} attempts, performing debug checks...`);
        
        // Debug: Check all users
        const allUsers = await readClient.user.findMany({
          select: { id: true, email: true, name: true, qrCodes: true },
        });
        console.log(`📊 Total users in database: ${allUsers.length}`);
        allUsers.forEach(u => {
          console.log(`   - ${u.email} (${u.id}): ${u.qrCodes?.length || 0} QRs`);
        });

        // Debug: Check all QRs
        const allQRs = await readClient.qRCode.findMany({
          select: { id: true, shortId: true, name: true, userId: true, createdAt: true },
        });
        console.log(`📊 Total QRs in database: ${allQRs.length}`);
        allQRs.forEach(q => {
          console.log(`   - ${q.shortId}: "${q.name}" (user: ${q.userId}, created: ${q.createdAt})`);
        });
      }

      return qrCodes;

    } catch (error: any) {
      console.error(`❌ getUserQRCodes failed:`, error.message);
      return []; // Return empty array on error for graceful degradation
    }
  }

  // Enhanced QR lookup for redirects with multi-client fallback
  static async getQRByShortId(shortId: string) {
    console.log(`🔍 getQRByShortId called: ${shortId}`);
    
    try {
      // Strategy 1: Read client first
      let qrCode = await withRetry(async () => {
        return await readClient.qRCode.findUnique({
          where: { shortId },
          include: {
            variants: {
              where: { isActive: true },
            },
          },
        });
      }, `qr-lookup-read-${shortId}`);

      if (qrCode) {
        console.log(`✅ QR found using read client: ${shortId}`);
        return qrCode;
      }

      // Strategy 2: Write client fallback
      console.log(`⚠️  QR not found in read client, trying write client: ${shortId}`);
      qrCode = await withRetry(async () => {
        return await writeClient.qRCode.findUnique({
          where: { shortId },
          include: {
            variants: {
              where: { isActive: true },
            },
          },
        });
      }, `qr-lookup-write-${shortId}`);

      if (qrCode) {
        console.log(`✅ QR found using write client: ${shortId}`);
        return qrCode;
      }

      // Strategy 3: Direct SQL query
      console.log(`⚠️  QR not found in either client, trying direct query: ${shortId}`);
      const directResult = await withRetry(async () => {
        return await readClient.$queryRaw`
          SELECT * FROM qr_codes WHERE "shortId" = ${shortId} LIMIT 1
        ` as any[];
      }, `qr-lookup-direct-${shortId}`);

      if (directResult.length > 0) {
        console.log(`✅ QR found using direct query: ${shortId}`);
        // Convert raw result to proper format
        return {
          ...directResult[0],
          variants: [],
        };
      }

      console.log(`❌ QR not found anywhere: ${shortId}`);
      return null;

    } catch (error: any) {
      console.error(`❌ getQRByShortId failed for ${shortId}:`, error.message);
      return null;
    }
  }

  // Compatibility methods
  static async getQRCode(shortId: string) {
    return await this.getQRByShortId(shortId);
  }

  static async getActiveVariant(qrCodeId: string) {
    try {
      const variants = await readClient.qRVariant.findMany({
        where: {
          qrCodeId,
          isActive: true,
        },
        orderBy: { weight: 'desc' },
      });
      
      return variants.length > 0 ? variants[0] : null;
    } catch (error: any) {
      console.error(`❌ getActiveVariant failed for ${qrCodeId}:`, error.message);
      return null;
    }
  }

  static async recordScan(qrCodeId: string, scanData: any) {
    try {
      // Use write client for recording scans
      await withRetry(async () => {
        return await writeClient.$transaction(async (tx) => {
          // Create scan record
          await tx.scan.create({
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
            },
          });

          // Update QR code scan count
          await tx.qRCode.update({
            where: { id: qrCodeId },
            data: {
              totalScans: { increment: 1 },
              lastScanned: new Date(),
            },
          });
        });
      }, `record-scan-${qrCodeId}`);

      console.log(`✅ Scan recorded for QR ${qrCodeId}`);
    } catch (error: any) {
      console.error(`❌ recordScan failed for ${qrCodeId}:`, error.message);
      // Don't throw error to avoid breaking redirects
    }
  }

  // Enhanced QR deletion with proper verification and cleanup
  static async deleteQRCode(qrCodeId: string, userId: string) {
    console.log(`🗑️  deleteQRCode called: qrCodeId=${qrCodeId}, userId=${userId}`);
    
    try {
      // First, ensure user exists and get their actual database ID
      const user = await this.ensureUser(userId, `User ${userId}`);
      console.log(`✅ User verified for deletion: ${user.id}`);

      // Verify the QR code exists and belongs to the user
      const qrCode = await withRetry(async () => {
        return await readClient.qRCode.findFirst({
          where: {
            id: qrCodeId,
            userId: user.id,
          },
        });
      }, `find-qr-for-deletion-${qrCodeId}`);

      if (!qrCode) {
        console.error(`❌ QR code not found or access denied: ${qrCodeId} for user ${user.id}`);
        throw new Error('QR Code not found or access denied');
      }

      console.log(`✅ QR code verified for deletion: ${qrCode.shortId}`);

      // Delete the QR code and all associated data using write client
      await withRetry(async () => {
        return await writeClient.$transaction(async (tx) => {
          // Delete associated scans first
          await tx.scan.deleteMany({
            where: { qrCodeId: qrCodeId },
          });

          // Delete associated variants
          await tx.qRVariant.deleteMany({
            where: { qrCodeId: qrCodeId },
          });

          // Finally delete the QR code itself
          await tx.qRCode.delete({
            where: { id: qrCodeId },
          });

          console.log(`🗑️  Deleted QR code and all associated data: ${qrCodeId}`);
        });
      }, `delete-qr-${qrCodeId}`);

      console.log(`✅ QR code deletion completed: ${qrCodeId}`);
      return { success: true, message: 'QR Code deleted successfully' };

    } catch (error: any) {
      console.error(`❌ deleteQRCode failed for ${qrCodeId}:`, error.message);
      throw error;
    }
  }
}