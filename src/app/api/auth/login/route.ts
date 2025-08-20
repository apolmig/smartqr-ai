import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { authRateLimiter, getClientIP } from '@/lib/rate-limit';
import { ApiResponseHelper, handleAsyncError } from '@/lib/api-response';
const SESSION_EXPIRY_HOURS = 24;
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIP = getClientIP(request);
    const rateLimitResult = await authRateLimiter.checkLimit(clientIP);
    
    if (!rateLimitResult.allowed) {
      return ApiResponseHelper.rateLimited(rateLimitResult.error);
    }

    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return ApiResponseHelper.badRequest('Email and password are required');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      return ApiResponseHelper.invalidCredentials();
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
      );
      return ApiResponseHelper.accountLocked(remainingMinutes);
    }

    // Check if account is active
    if (!user.isActive) {
      return ApiResponseHelper.accountDisabled();
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      // Increment failed attempts
      const newAttempts = user.loginAttempts + 1;
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000)
            : null,
        },
      });

      if (shouldLock) {
        return ApiResponseHelper.accountLocked(ACCOUNT_LOCK_DURATION_MINUTES);
      }

      return ApiResponseHelper.invalidCredentials();
    }

    // Get client information
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || undefined;

    // Reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });

    // Create session
    const sessionId = crypto.randomBytes(16).toString('hex');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        sessionId,
        token,
        ipAddress,
        userAgent,
        expiresAt,
        isActive: true,
      },
    });

    console.log('User logged in successfully:', user.email);

    return ApiResponseHelper.success({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        emailVerified: user.emailVerified,
      },
      session: {
        token,
        expiresAt,
      },
    }, 'Login successful');

  } catch (error) {
    console.error('Login error:', error);
    return ApiResponseHelper.internalError('Login failed due to server error');
  }
}