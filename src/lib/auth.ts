// Simple localStorage-based authentication system
export interface User {
  id: string;
  name: string;
  email: string;
  plan: 'FREE' | 'SMART' | 'GENIUS' | 'ENTERPRISE';
  createdAt: string;
  qrCodesCount: number;
  scansCount: number;
}

export class AuthManager {
  private readonly STORAGE_KEY = 'smartqr_user';
  private readonly DEFAULT_LIMITS = {
    FREE: { qrCodes: 3, scansPerMonth: 1000 },
    SMART: { qrCodes: 25, scansPerMonth: 10000 },
    GENIUS: { qrCodes: 100, scansPerMonth: 50000 },
    ENTERPRISE: { qrCodes: -1, scansPerMonth: -1 } // Unlimited
  };

  // Get current user from localStorage
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const userData = localStorage.getItem(this.STORAGE_KEY);
      if (!userData) return null;
      
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      return null;
    }
  }

  // Create new user account
  createUser(name: string, email: string, plan: User['plan'] = 'FREE'): User {
    const user: User = {
      id: email.trim().toLowerCase(), // Use email as consistent ID
      name: name.trim(),
      email: email.trim().toLowerCase(),
      plan,
      createdAt: new Date().toISOString(),
      qrCodesCount: 0,
      scansCount: 0
    };

    this.saveUser(user);
    return user;
  }

  // Login user (for demo, just create/load user)
  loginUser(email: string, name?: string): User {
    const normalizedEmail = email.trim().toLowerCase();
    
    // First try to find existing user by email in localStorage
    const existingUser = this.getCurrentUser();
    if (existingUser && existingUser.email === normalizedEmail) {
      return existingUser;
    }

    // Create new user with email as ID for consistency across browsers
    return this.createUser(name || normalizedEmail.split('@')[0], normalizedEmail);
  }

  // Update user data
  updateUser(updates: Partial<User>): User | null {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return null;

    const updatedUser = { ...currentUser, ...updates };
    this.saveUser(updatedUser);
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
    return this.getCurrentUser() !== null;
  }

  // Get user limits based on plan
  getUserLimits(user?: User): { qrCodes: number; scansPerMonth: number } {
    const currentUser = user || this.getCurrentUser();
    if (!currentUser) return this.DEFAULT_LIMITS.FREE;
    
    return this.DEFAULT_LIMITS[currentUser.plan];
  }

  // Check if user can create more QR codes
  canCreateQRCode(user?: User): { canCreate: boolean; reason?: string } {
    const currentUser = user || this.getCurrentUser();
    if (!currentUser) return { canCreate: false, reason: 'Not authenticated' };

    const limits = this.getUserLimits(currentUser);
    if (limits.qrCodes === -1) return { canCreate: true }; // Unlimited

    if (currentUser.qrCodesCount >= limits.qrCodes) {
      return {
        canCreate: false,
        reason: `You've reached your limit of ${limits.qrCodes} QR codes. Upgrade to create more.`
      };
    }

    return { canCreate: true };
  }

  // Increment QR code count
  incrementQRCount(): void {
    const user = this.getCurrentUser();
    if (user) {
      this.updateUser({ qrCodesCount: user.qrCodesCount + 1 });
    }
  }

  // Increment scan count
  incrementScanCount(): void {
    const user = this.getCurrentUser();
    if (user) {
      this.updateUser({ scansCount: user.scansCount + 1 });
    }
  }

  private saveUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    }
  }

  private generateUserId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Get plan display info
  getPlanInfo(plan: User['plan']): {
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

    return plans[plan];
  }
}

// Global auth manager instance
export const authManager = new AuthManager();