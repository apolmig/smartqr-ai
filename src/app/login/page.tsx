'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (usePassword) {
        // Password-based login
        const result = await loginWithPassword(email, password);
        if (!result.success) {
          setError(result.error || 'Login failed');
          return;
        }
      } else {
        // Legacy email-only login
        await login(email);
      }
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError('Error logging in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      await login('demo@smartqr.ai', 'Demo User');
      router.push('/dashboard');
    } catch (error) {
      console.error('Demo login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">SmartQR</span>
                <div className="text-xs text-gray-500">QR Codes That Learn</div>
              </div>
            </Link>
            <Link 
              href="/signup" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Don't have an account?
            </Link>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in to your SmartQR account
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Login Mode Toggle */}
            <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setUsePassword(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  usePassword
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🔐 Secure Login
              </button>
              <button
                type="button"
                onClick={() => setUsePassword(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !usePassword
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📧 Email Only
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
                  placeholder="Enter your email address"
                />
              </div>

              {usePassword && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required={usePassword}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
                    placeholder="Enter your password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing In...
                  </div>
                ) : (
                  usePassword ? 'Sign In' : 'Continue with Email'
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🚀 Try Demo Account
              </button>

              <div className="text-center">
                <span className="text-gray-600">New to SmartQR? </span>
                <Link href="/signup" className="text-blue-600 hover:text-blue-500 font-medium">
                  Create free account
                </Link>
              </div>
              
              {usePassword && (
                <div className="text-center">
                  <Link href="/forgot-password" className="text-sm text-gray-600 hover:text-blue-500">
                    Forgot your password?
                  </Link>
                </div>
              )}
            </form>
          </div>

          {/* Login Info */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">
              {usePassword ? '🔐 Secure Authentication' : '🎯 Try the Demo Account'}
            </h3>
            {usePassword ? (
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Password-protected account access</li>
                <li>• Secure session management</li>
                <li>• Account lockout protection</li>
                <li>• Enhanced security features</li>
              </ul>
            ) : (
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Pre-loaded with sample QR codes</li>
                <li>• See AI insights in action</li>
                <li>• Test smart routing features</li>
                <li>• No signup required</li>
              </ul>
            )}
          </div>

          {/* Quick Info */}
          <div className="text-center">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-green-600">🔒</span>
                </div>
                <span>Secure Login</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-blue-600">⚡</span>
                </div>
                <span>Instant Access</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}