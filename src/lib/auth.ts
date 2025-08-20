// Client-safe auth service - no server-side imports
// This service communicates with API endpoints for authentication

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  isActive: boolean;
  plan: string;
  lastLogin: Date | null;
}

export interface SessionData {
  sessionId: string;
  token: string;
  userId: string;
  expiresAt: Date;
}

// Legacy interface for backward compatibility
export interface User {
  id: string;
  name: string;
  email: string;
  plan: 'FREE' | 'SMART' | 'GENIUS' | 'ENTERPRISE';
  createdAt: string;
  qrCodesCount: number;
  scansCount: number;
}

export class AuthService {
  // Storage keys
  private readonly LEGACY_STORAGE_KEY = 'smartqr_user';
  private readonly SESSION_STORAGE_KEY = 'smartqr_session';
  private readonly DEFAULT_LIMITS = {
    FREE: { qrCodes: 3, scansPerMonth: 1000 },
    SMART: { qrCodes: 25, scansPerMonth: 10000 },
    GENIUS: { qrCodes: 100, scansPerMonth: 50000 },
    ENTERPRISE: { qrCodes: -1, scansPerMonth: -1 } // Unlimited
  };

  /**
   * Register new user with password
   */
  async register(email: string, password: string, name: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error?.message || data.error || 'Registration failed' };
      }

      return { success: true, user: data.data?.user || data.user };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error occurred' };
    }
  }

  /**
   * Login user with password
   */
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error?.message || data.error || 'Login failed' };
      }

      // Store session token
      if (typeof window !== 'undefined') {
        const sessionToken = data.data?.session?.token || data.session?.token;
        if (sessionToken) {
          localStorage.setItem(this.SESSION_STORAGE_KEY, sessionToken);
          // Remove legacy storage to prioritize new auth
          localStorage.removeItem(this.LEGACY_STORAGE_KEY);
        }
      }

      const userData = data.data?.user || data.user;
      const user = this.convertAuthUserToLegacyUser(userData);
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error occurred' };
    }
  }

  /**
   * Get current user session (check database session first, fallback to localStorage)
   */
  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined') return null;
    
    try {
      // Check for database session first
      const sessionToken = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (sessionToken) {
        const authUser = await this.validateSession(sessionToken);
        if (authUser) {
          return this.convertAuthUserToLegacyUser(authUser);
        }
        // Clean up invalid session
        localStorage.removeItem(this.SESSION_STORAGE_KEY);
      }

      // Fallback to legacy localStorage auth for existing users
      const userData = localStorage.getItem(this.LEGACY_STORAGE_KEY);
      if (!userData) return null;
      
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      return null;
    }
  }

  /**
   * Convert AuthUser to legacy User format for compatibility
   */
  private convertAuthUserToLegacyUser(authUser: AuthUser): User {
    return {
      id: authUser.id,
      name: authUser.name || '',
      email: authUser.email,
      plan: authUser.plan as 'FREE' | 'SMART' | 'GENIUS' | 'ENTERPRISE',
      createdAt: new Date().toISOString(),
      qrCodesCount: 0, // Will be loaded from database
      scansCount: 0,
    };
  }

  /**
   * Validate session token with API
   */
  async validateSession(token: string): Promise<AuthUser | null> {
    try {
      const response = await fetch('/api/auth/session', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data?.user || data.user;
    } catch (error) {
      console.error('Session validation error:', error);
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

  // Legacy login user (for demo, just create/load user)
  loginUser(email: string, name?: string): User {
    const normalizedEmail = email.trim().toLowerCase();
    
    // For legacy method, we need to handle localStorage synchronously
    if (typeof window === 'undefined') {
      throw new Error('loginUser can only be called in browser environment');
    }

    // Try to find existing user by email in localStorage
    const userData = localStorage.getItem(this.LEGACY_STORAGE_KEY);
    if (userData) {
      const existingUser = JSON.parse(userData);
      if (existingUser.email === normalizedEmail) {
        return existingUser;
      }
    }

    // Create new user with email as ID for consistency across browsers
    return this.createUser(name || normalizedEmail.split('@')[0], normalizedEmail);
  }

  // Update user data
  updateUser(updates: Partial<User>): User | null {
    if (typeof window === 'undefined') return null;
    
    const userData = localStorage.getItem(this.LEGACY_STORAGE_KEY);
    if (!userData) return null;
    
    const currentUser = JSON.parse(userData);
    const updatedUser = { ...currentUser, ...updates };
    this.saveUser(updatedUser);
    return updatedUser;
  }

  // Logout user
  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      const sessionToken = localStorage.getItem(this.SESSION_STORAGE_KEY);
      
      // Call logout API if we have a session token
      if (sessionToken) {
        try {
          await fetch('/api/auth/session', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
            },
          });
        } catch (error) {
          console.error('Logout API error:', error);
        }
      }
      
      // Clear all auth data
      localStorage.removeItem(this.SESSION_STORAGE_KEY);
      localStorage.removeItem(this.LEGACY_STORAGE_KEY);
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  // Get user limits based on plan
  getUserLimits(user?: User | null): { qrCodes: number; scansPerMonth: number } {
    if (!user) return this.DEFAULT_LIMITS.FREE;
    return this.DEFAULT_LIMITS[user.plan];
  }

  // Check if user can create more QR codes
  canCreateQRCode(user?: User | null): { canCreate: boolean; reason?: string } {
    if (!user) return { canCreate: false, reason: 'Not authenticated' };

    const limits = this.getUserLimits(user);
    if (limits.qrCodes === -1) return { canCreate: true }; // Unlimited

    if (user.qrCodesCount >= limits.qrCodes) {
      return {
        canCreate: false,
        reason: `You've reached your limit of ${limits.qrCodes} QR codes. Upgrade to create more.`
      };
    }

    return { canCreate: true };
  }

  // Increment QR code count
  incrementQRCount(): void {
    if (typeof window === 'undefined') return;
    
    const userData = localStorage.getItem(this.LEGACY_STORAGE_KEY);
    if (userData) {
      const user = JSON.parse(userData);
      this.updateUser({ qrCodesCount: user.qrCodesCount + 1 });
    }
  }

  // Increment scan count
  incrementScanCount(): void {
    if (typeof window === 'undefined') return;
    
    const userData = localStorage.getItem(this.LEGACY_STORAGE_KEY);
    if (userData) {
      const user = JSON.parse(userData);
      this.updateUser({ scansCount: user.scansCount + 1 });
    }
  }

  private saveUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.LEGACY_STORAGE_KEY, JSON.stringify(user));
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

// Global auth service instance
export const authService = new AuthService();