import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { authRateLimiter, getClientIP } from '@/lib/rate-limit';
import { ApiResponseHelper } from '@/lib/api-response';
const SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIP = getClientIP(request);
    const rateLimitResult = await authRateLimiter.checkLimit(clientIP);
    
    if (!rateLimitResult.allowed) {
      return ApiResponseHelper.rateLimited(rateLimitResult.error);
    }

    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return ApiResponseHelper.badRequest('Email, password, and name are required');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ApiResponseHelper.badRequest('Invalid email format', 'email');
    }

    // Password strength validation
    if (password.length < 8) {
      return ApiResponseHelper.badRequest('Password must be at least 8 characters long', 'password');
    }

    // Password complexity validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      return ApiResponseHelper.weakPassword();
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return ApiResponseHelper.userExists();
    }

    // Hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name.trim(),
        passwordHash,
        salt,
        emailVerified: false,
        isActive: true,
        loginAttempts: 0,
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    console.log('User registered successfully:', user.email);

    return ApiResponseHelper.success({
      user,
    }, 'User registered successfully');

  } catch (error) {
    console.error('Registration error:', error);
    return ApiResponseHelper.internalError('Registration failed due to server error');
  }
}