'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'SMART' | 'GENIUS'>('FREE');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Create user account
      const user = await login(email, name);
      
      // Update plan if not free
      if (selectedPlan !== 'FREE') {
        // For now, just set the plan (in real app would handle payment first)
        user.plan = selectedPlan;
      }
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Signup error:', error);
      alert('Error creating account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const plans = [
    {
      id: 'FREE' as const,
      name: 'Free',
      price: '$0',
      period: 'forever',
      popular: false,
      features: [
        '3 dynamic QR codes',
        'Basic analytics',
        'Unlimited URL changes',
        'Mobile dashboard'
      ]
    },
    {
      id: 'SMART' as const,
      name: 'Smart',
      price: '$19',
      period: 'per month',
      popular: true,
      features: [
        '25 dynamic QR codes',
        'AI smart routing',
        'Advanced analytics',
        'A/B testing',
        'Priority support'
      ]
    },
    {
      id: 'GENIUS' as const,
      name: 'Genius',
      price: '$49',
      period: 'per month',
      popular: false,
      features: [
        '100 dynamic QR codes',
        'Advanced AI insights',
        'Custom integrations',
        'Team collaboration',
        'White-label options'
      ]
    }
  ];

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
                <span className="text-xl font-bold text-gray-900">SmartQR.ai</span>
                <div className="text-xs text-gray-500">QR Codes That Learn</div>
              </div>
            </Link>
            <Link 
              href="/login" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600">
            Start free, upgrade anytime. All plans include our AI-powered features.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg p-8 cursor-pointer border-2 transition-all ${
                selectedPlan === plan.id
                  ? 'border-blue-500 transform scale-105'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="text-center">
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={selectedPlan === plan.id}
                  onChange={() => setSelectedPlan(plan.id)}
                  className="w-5 h-5 text-blue-600"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Signup Form */}
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Create Your Account
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email address"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Selected Plan:</span>
                  <span className="text-blue-600 font-semibold">
                    {plans.find(p => p.id === selectedPlan)?.name} - {plans.find(p => p.id === selectedPlan)?.price}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating Account...
                  </div>
                ) : (
                  `Start with ${plans.find(p => p.id === selectedPlan)?.name} Plan`
                )}
              </button>

              <div className="text-center text-sm text-gray-500">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </div>
            </form>
          </div>

          {/* Benefits */}
          <div className="mt-8 text-center">
            <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-green-600">⚡</span>
                </div>
                <span>2-min setup</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-blue-600">🔒</span>
                </div>
                <span>Secure & private</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-purple-600">🚀</span>
                </div>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}