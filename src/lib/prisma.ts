// Enhanced Prisma client with performance optimizations
import { prisma, DatabaseOptimizer, checkDatabaseHealth, performDatabaseCleanup } from './database-config';

// Export optimized database client and utilities
export default prisma;
export { DatabaseOptimizer, checkDatabaseHealth, performDatabaseCleanup };

// Plan limits configuration
export const PLAN_LIMITS = {
  FREE: {
    qrCodes: 3,
    scansPerMonth: 1000,
    aiFeatures: false,
    analytics: 'basic',
    customDomains: 0,
  },
  SMART: {
    qrCodes: 25,
    scansPerMonth: 10000,
    aiFeatures: true,
    analytics: 'advanced',
    customDomains: 1,
  },
  GENIUS: {
    qrCodes: 100,
    scansPerMonth: 50000,
    aiFeatures: true,
    analytics: 'advanced',
    customDomains: 3,
  },
  ENTERPRISE: {
    qrCodes: -1, // unlimited
    scansPerMonth: -1, // unlimited
    aiFeatures: true,
    analytics: 'enterprise',
    customDomains: 10,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export const getPlanLimits = (plan: string) => {
  return PLAN_LIMITS[plan as PlanType] || PLAN_LIMITS.FREE;
};

// Helper functions for database operations
export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
    include: { qrCodes: true },
  });
};

export const createUser = async (data: {
  email: string;
  name?: string;
  plan?: string;
}) => {
  return await prisma.user.create({
    data: {
      ...data,
      qrCodeLimit: getPlanLimits(data.plan || 'FREE').qrCodes,
    },
  });
};

export const updateUserPlan = async (userId: string, plan: string, stripeData?: {
  customerId?: string;
  subscriptionId?: string;
  priceId?: string;
  currentPeriodEnd?: Date;
}) => {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      qrCodeLimit: getPlanLimits(plan).qrCodes,
      ...stripeData && {
        stripeCustomerId: stripeData.customerId,
        stripeSubscriptionId: stripeData.subscriptionId,
        stripePriceId: stripeData.priceId,
        stripeCurrentPeriodEnd: stripeData.currentPeriodEnd,
      },
    },
  });
};