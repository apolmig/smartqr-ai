// Hybrid Authentication System - works with both localStorage and database
import { User } from '@prisma/client';
import prisma, { createUser, getUserByEmail, getPlanLimits } from './prisma';

export interface AuthUser extends Omit<User, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export class HybridAuthManager {
  private readonly STORAGE_KEY = 'smartqr_user';

  // Get current user - tries database first, then localStorage
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      // Try localStorage first for immediate UI
      const localUser = this.getLocalUser();
      
      // If we have a local user with email, try to sync with database
      if (localUser?.email) {
        try {
          const dbUser = await getUserByEmail(localUser.email);
          if (dbUser) {
            // Update localStorage with database data
            const syncedUser = this.userToAuthUser(dbUser);
            this.saveLocalUser(syncedUser);
            return syncedUser;
          }
        } catch (error) {
          console.warn('Database sync failed, using localStorage:', error);
          return localUser;
        }
      }

      return localUser;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Get user from localStorage only
  getLocalUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const userData = localStorage.getItem(this.STORAGE_KEY);
      if (!userData) return null;
      
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error loading local user:', error);
      return null;
    }
  }

  // Create new user account
  async createUser(name: string, email: string, plan: string = 'FREE'): Promise<AuthUser> {
    const userData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      plan,
    };

    try {
      // Try to create in database first
      const dbUser = await createUser(userData);
      const authUser = this.userToAuthUser(dbUser);
      this.saveLocalUser(authUser);
      return authUser;
    } catch (error) {
      console.warn('Database creation failed, using localStorage:', error);
      
      // Fallback to localStorage
      const localUser: AuthUser = {
        id: this.generateUserId(),
        email: userData.email,
        name: userData.name,
        plan: userData.plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        qrCodeLimit: getPlanLimits(userData.plan).qrCodes,
        image: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      };

      this.saveLocalUser(localUser);
      return localUser;
    }
  }

  // Login user
  async loginUser(email: string, name?: string): Promise<AuthUser> {
    const trimmedEmail = email.trim().toLowerCase();
    
    try {
      // Try to find existing user in database
      const dbUser = await getUserByEmail(trimmedEmail);
      if (dbUser) {
        const authUser = this.userToAuthUser(dbUser);
        this.saveLocalUser(authUser);
        return authUser;
      }
    } catch (error) {
      console.warn('Database login failed, checking localStorage:', error);
    }

    // Check localStorage
    const localUser = this.getLocalUser();
    if (localUser && localUser.email === trimmedEmail) {
      return localUser;
    }

    // Create new user
    return this.createUser(name || email.split('@')[0], email);
  }

  // Update user data
  async updateUser(updates: Partial<AuthUser>): Promise<AuthUser | null> {
    const currentUser = this.getLocalUser();
    if (!currentUser) return null;

    const updatedUser = { 
      ...currentUser, 
      ...updates,
      updatedAt: new Date().toISOString()
    };

    try {
      // Try to update in database if user exists there
      if (currentUser.email) {
        const dbUser = await getUserByEmail(currentUser.email);
        if (dbUser) {
          const dbUpdatedUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              ...updates,
              qrCodeLimit: updates.plan ? getPlanLimits(updates.plan).qrCodes : undefined,
            },
          });
          const syncedUser = this.userToAuthUser(dbUpdatedUser);
          this.saveLocalUser(syncedUser);
          return syncedUser;
        }
      }
    } catch (error) {
      console.warn('Database update failed, using localStorage:', error);
    }

    // Fallback to localStorage update
    this.saveLocalUser(updatedUser);
    return updatedUser;
  }

  // Logout user
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getLocalUser() !== null;
  }

  // Get user limits based on plan
  getUserLimits(user?: AuthUser): ReturnType<typeof getPlanLimits> {
    const currentUser = user || this.getLocalUser();
    if (!currentUser) return getPlanLimits('FREE');
    
    return getPlanLimits(currentUser.plan);
  }

  // Check if user can create more QR codes
  async canCreateQRCode(user?: AuthUser): Promise<{ canCreate: boolean; reason?: string }> {
    const currentUser = user || await this.getCurrentUser();
    if (!currentUser) return { canCreate: false, reason: 'Not authenticated' };

    const limits = this.getUserLimits(currentUser);
    if (limits.qrCodes === -1) return { canCreate: true }; // Unlimited

    // Get actual QR code count from database or estimate from localStorage
    let qrCodeCount = 0;
    try {
      if (currentUser.email) {
        const dbUser = await getUserByEmail(currentUser.email);
        if (dbUser) {
          const qrCodes = await prisma.qRCode.count({
            where: { userId: dbUser.id }
          });
          qrCodeCount = qrCodes;
        }
      }
    } catch (error) {
      console.warn('Could not get QR code count from database');
      // Fallback to estimated count (not accurate but better than nothing)
      qrCodeCount = 0;
    }

    if (qrCodeCount >= limits.qrCodes) {
      return {
        canCreate: false,
        reason: `You've reached your limit of ${limits.qrCodes} QR codes. Upgrade to create more.`
      };
    }

    return { canCreate: true };
  }

  // Get plan display info
  getPlanInfo(plan: string): {
    name: string;
    price: string;
    color: string;
    features: string[];
  } {
    const plans = {
      FREE: {
        name: 'Free',
        price: '$0',
        color: 'text-gray-600 bg-gray-100',
        features: ['3 QR codes', 'Basic analytics', 'Dynamic URLs']
      },
      SMART: {
        name: 'Smart',
        price: '$19/mo',
        color: 'text-blue-600 bg-blue-100',
        features: ['25 QR codes', 'AI insights', 'Smart routing', 'A/B testing']
      },
      GENIUS: {
        name: 'Genius',
        price: '$49/mo',
        color: 'text-purple-600 bg-purple-100',
        features: ['100 QR codes', 'Advanced AI', 'Integrations', 'Priority support']
      },
      ENTERPRISE: {
        name: 'Enterprise',
        price: '$149/mo',
        color: 'text-green-600 bg-green-100',
        features: ['Unlimited QRs', 'Custom AI', 'API access', 'Dedicated support']
      }
    };

    return plans[plan as keyof typeof plans] || plans.FREE;
  }

  // Convert database user to auth user
  private userToAuthUser(dbUser: User): AuthUser {
    return {
      ...dbUser,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };
  }

  // Save user to localStorage
  private saveLocalUser(user: AuthUser): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    }
  }

  private generateUserId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Global hybrid auth manager instance
export const hybridAuth = new HybridAuthManager();