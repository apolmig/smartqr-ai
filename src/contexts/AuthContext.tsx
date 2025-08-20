'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, authService } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, name?: string) => Promise<User>; // Legacy
  loginWithPassword: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; user?: any; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => User | null;
  canCreateQRCode: () => { canCreate: boolean; reason?: string };
  incrementQRCount: () => void;
  incrementScanCount: () => void;
  getUserLimits: () => { qrCodes: number; scansPerMonth: number };
  getPlanInfo: () => {
    name: string;
    price: string;
    color: string;
    features: string[];
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user from storage/session on mount
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUser();
  }, []);

  // Legacy login method for compatibility
  const login = async (email: string, name?: string): Promise<User> => {
    const loggedInUser = authService.loginUser(email, name);
    setUser(loggedInUser);
    return loggedInUser;
  };

  // New password-based login
  const loginWithPassword = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  // Registration
  const register = async (email: string, password: string, name: string) => {
    return await authService.register(email, password, name);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateUser = (updates: Partial<User>): User | null => {
    const updatedUser = authService.updateUser(updates);
    if (updatedUser) {
      setUser(updatedUser);
    }
    return updatedUser;
  };

  const canCreateQRCode = () => {
    return authService.canCreateQRCode(user);
  };

  const incrementQRCount = async () => {
    authService.incrementQRCount();
    const updatedUser = await authService.getCurrentUser();
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  const incrementScanCount = async () => {
    authService.incrementScanCount();
    const updatedUser = await authService.getCurrentUser();
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  const getUserLimits = () => {
    return authService.getUserLimits(user);
  };

  const getPlanInfo = () => {
    return authService.getPlanInfo(user?.plan || 'FREE');
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    loginWithPassword,
    register,
    logout,
    updateUser,
    canCreateQRCode,
    incrementQRCount,
    incrementScanCount,
    getUserLimits,
    getPlanInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for components that require authentication
export function useRequireAuth() {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      // Redirect to login or show login modal
      window.location.href = '/login';
    }
  }, [auth.isLoading, auth.user]);

  return auth;
}