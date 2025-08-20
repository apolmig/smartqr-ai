import prisma from '@/lib/prisma';

export class SessionCleanup {
  /**
   * Clean up expired sessions from the database
   */
  static async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    try {
      const result = await prisma.userSession.deleteMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            {
              isActive: false,
            },
          ],
        },
      });

      console.log(`Cleaned up ${result.count} expired/inactive sessions`);
      return { deletedCount: result.count };
    } catch (error) {
      console.error('Session cleanup error:', error);
      throw error;
    }
  }

  /**
   * Clean up sessions for a specific user (useful when user changes password)
   */
  static async cleanupUserSessions(userId: string, keepCurrentSession?: string): Promise<{ deletedCount: number }> {
    try {
      const whereClause: any = {
        userId,
      };

      // If keeping current session, exclude it from deletion
      if (keepCurrentSession) {
        whereClause.NOT = {
          token: keepCurrentSession,
        };
      }

      const result = await prisma.userSession.updateMany({
        where: whereClause,
        data: {
          isActive: false,
        },
      });

      console.log(`Deactivated ${result.count} sessions for user ${userId}`);
      return { deletedCount: result.count };
    } catch (error) {
      console.error('User session cleanup error:', error);
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  static async getSessionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
  }> {
    try {
      const now = new Date();
      
      const [total, active, expired] = await Promise.all([
        prisma.userSession.count(),
        prisma.userSession.count({
          where: {
            isActive: true,
            expiresAt: { gt: now },
          },
        }),
        prisma.userSession.count({
          where: {
            OR: [
              { isActive: false },
              { expiresAt: { lte: now } },
            ],
          },
        }),
      ]);

      return { total, active, expired };
    } catch (error) {
      console.error('Session stats error:', error);
      throw error;
    }
  }

  /**
   * Start automatic cleanup process (call this on app startup)
   */
  static startAutomaticCleanup(intervalMinutes = 60): void {
    // Clean up immediately
    this.cleanupExpiredSessions().catch(console.error);

    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupExpiredSessions().catch(console.error);
    }, intervalMinutes * 60 * 1000);

    console.log(`Session cleanup started with ${intervalMinutes} minute intervals`);
  }
}