'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, authManager } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, name?: string) => Promise<User>;
  logout: () => void;
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
    // Load user from localStorage on mount
    const currentUser = authManager.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  const login = async (email: string, name?: string): Promise<User> => {
    const loggedInUser = authManager.loginUser(email, name);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    authManager.logout();
    setUser(null);
  };

  const updateUser = (updates: Partial<User>): User | null => {
    const updatedUser = authManager.updateUser(updates);
    if (updatedUser) {
      setUser(updatedUser);
    }
    return updatedUser;
  };

  const canCreateQRCode = () => {
    return authManager.canCreateQRCode(user);
  };

  const incrementQRCount = () => {
    authManager.incrementQRCount();
    const updatedUser = authManager.getCurrentUser();
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  const incrementScanCount = () => {
    authManager.incrementScanCount();
    const updatedUser = authManager.getCurrentUser();
    if (updatedUser) {
      setUser(updatedUser);
    }
  };

  const getUserLimits = () => {
    return authManager.getUserLimits(user);
  };

  const getPlanInfo = () => {
    return authManager.getPlanInfo(user?.plan || 'FREE');
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
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