import { NextResponse } from 'next/server';

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  errors?: ApiError[];
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Predefined error types
export const ErrorCodes = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  
  // Resources
  USER_EXISTS: 'USER_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export class ApiResponseHelper {
  static success<T>(data: T, message?: string, status = 200): NextResponse {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      ...(message && { message }),
    };
    
    return NextResponse.json(response, { status });
  }

  static error(
    code: string,
    message: string,
    status = 400,
    field?: string,
    errors?: ApiError[]
  ): NextResponse {
    const response: ApiErrorResponse = {
      success: false,
      error: { code, message, ...(field && { field }) },
      ...(errors && { errors }),
    };
    
    return NextResponse.json(response, { status });
  }

  // Common error responses
  static badRequest(message: string, field?: string): NextResponse {
    return this.error(ErrorCodes.VALIDATION_ERROR, message, 400, field);
  }

  static unauthorized(message = 'Unauthorized access'): NextResponse {
    return this.error(ErrorCodes.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = 'Access forbidden'): NextResponse {
    return this.error(ErrorCodes.UNAUTHORIZED, message, 403);
  }

  static notFound(message = 'Resource not found'): NextResponse {
    return this.error(ErrorCodes.RESOURCE_NOT_FOUND, message, 404);
  }

  static conflict(message: string): NextResponse {
    return this.error(ErrorCodes.USER_EXISTS, message, 409);
  }

  static rateLimited(message = 'Too many requests'): NextResponse {
    return this.error(ErrorCodes.RATE_LIMIT_EXCEEDED, message, 429);
  }

  static internalError(message = 'Internal server error'): NextResponse {
    return this.error(ErrorCodes.INTERNAL_ERROR, message, 500);
  }

  // Authentication specific errors
  static invalidCredentials(): NextResponse {
    return this.error(
      ErrorCodes.INVALID_CREDENTIALS,
      'Invalid email or password',
      401
    );
  }

  static accountLocked(remainingMinutes: number): NextResponse {
    return this.error(
      ErrorCodes.ACCOUNT_LOCKED,
      `Account locked. Try again in ${remainingMinutes} minutes.`,
      423
    );
  }

  static accountDisabled(): NextResponse {
    return this.error(
      ErrorCodes.ACCOUNT_DISABLED,
      'Account is deactivated',
      403
    );
  }

  static sessionExpired(): NextResponse {
    return this.error(
      ErrorCodes.SESSION_EXPIRED,
      'Session has expired',
      401
    );
  }

  static weakPassword(): NextResponse {
    return this.error(
      ErrorCodes.WEAK_PASSWORD,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      400,
      'password'
    );
  }

  static userExists(): NextResponse {
    return this.error(
      ErrorCodes.USER_EXISTS,
      'User with this email already exists',
      409,
      'email'
    );
  }
}

// Helper function to handle async errors
export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  fallbackMessage = 'An unexpected error occurred'
): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error('API Error:', error);
    
    // Handle known Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return ApiResponseHelper.conflict('Resource already exists');
      }
      if (error.message.includes('Record to update not found')) {
        return ApiResponseHelper.notFound('Resource not found');
      }
    }
    
    return ApiResponseHelper.internalError(fallbackMessage);
  }
}