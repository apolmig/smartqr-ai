'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createCheckoutSession } from '@/lib/stripe';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const plans = [
    {
      id: 'FREE',
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      popular: false,
      description: 'Perfect for testing and personal use',
      features: [
        '3 dynamic QR codes',
        'Basic analytics',
        'Unlimited URL changes',
        'Mobile dashboard',
        'Community support'
      ],
      limitations: [
        'No AI features',
        'Basic templates only',
        'SmartQR.ai branding'
      ]
    },
    {
      id: 'SMART',
      name: 'Smart',
      price: { monthly: 19, yearly: 190 },
      popular: true,
      description: 'Best for small businesses and marketers',
      features: [
        '25 dynamic QR codes',
        'AI smart routing',
        'Advanced analytics with insights',
        'A/B testing',
        'Custom QR designs',
        'Email support',
        'Remove branding'
      ],
      limitations: []
    },
    {
      id: 'GENIUS',
      name: 'Genius',
      price: { monthly: 49, yearly: 490 },
      popular: false,
      description: 'For growing businesses and teams',
      features: [
        '100 dynamic QR codes',
        'Advanced AI insights & predictions',
        'Team collaboration',
        'Custom integrations (Zapier, webhooks)',
        'White-label options',
        'Priority support',
        'Advanced reporting'
      ],
      limitations: []
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise',
      price: { monthly: 149, yearly: 1490 },
      popular: false,
      description: 'For large organizations',
      features: [
        'Unlimited QR codes',
        'Custom AI training',
        'API access',
        'SSO integration',
        'Dedicated account manager',
        'Custom contracts',
        'SLA guarantees'
      ],
      limitations: []
    }
  ];

  const handleUpgrade = async (planId: string) => {
    if (planId === 'FREE') {
      // Downgrade to free
      updateUser({ plan: 'FREE' });
      router.push('/dashboard');
      return;
    }

    if (!user) {
      router.push('/signup');
      return;
    }

    setIsLoading(planId);

    try {
      // For demo purposes, simulate the upgrade
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      updateUser({ plan: planId as any });
      router.push('/dashboard?upgraded=true');
      
      // In production, you'd create a real Stripe checkout session:
      /*
      const priceId = STRIPE_PLANS[planId][billingPeriod];
      const session = await createCheckoutSession(priceId, user.id);
      window.location.href = session.url;
      */
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to process upgrade. Please try again.');
    } finally {
      setIsLoading(null);
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
                <span className="text-xl font-bold text-gray-900">SmartQR.ai</span>
                <div className="text-xs text-gray-500">Pricing</div>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              {user ? (
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-gray-600 hover:text-gray-900">
                    Login
                  </Link>
                  <Link href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Choose the perfect plan for your needs. Start free, upgrade anytime.
            All plans include our AI-powered features.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-8">
            <span className={`mr-3 ${billingPeriod === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`ml-3 ${billingPeriod === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Yearly
            </span>
            {billingPeriod === 'yearly' && (
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                Save 20%
              </span>
            )}
          </div>
        </div>

        {/* Current Plan Indicator */}
        {user && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Currently on {user.plan} plan
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
          {plans.map((plan) => {
            const price = plan.price[billingPeriod];
            const isCurrentPlan = user?.plan === plan.id;
            const isUpgrade = user && plan.id !== 'FREE' && plan.id !== user.plan;
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg p-8 ${
                  plan.popular 
                    ? 'ring-2 ring-blue-500 transform scale-105' 
                    : 'hover:shadow-xl transition-shadow'
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Current
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">${price}</span>
                    <span className="text-gray-600">
                      {plan.id === 'FREE' ? '' : `/${billingPeriod === 'monthly' ? 'mo' : 'yr'}`}
                    </span>
                  </div>
                  {billingPeriod === 'yearly' && plan.id !== 'FREE' && (
                    <p className="text-sm text-gray-500">
                      ${Math.round(price / 12)}/month billed annually
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-600">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                  {plan.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-start text-gray-400">
                      <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                        <span className="text-gray-400 text-sm">✗</span>
                      </div>
                      <span className="text-sm">{limitation}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isLoading === plan.id || isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                    isCurrentPlan
                      ? 'bg-green-100 text-green-800 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transform hover:scale-105'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading === plan.id ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2"></div>
                      Processing...
                    </div>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : plan.id === 'FREE' ? (
                    'Start Free'
                  ) : isUpgrade ? (
                    `Upgrade to ${plan.name}`
                  ) : (
                    `Get ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                q: "Can I change plans anytime?",
                a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately."
              },
              {
                q: "What happens if I exceed my QR code limit?",
                a: "You'll be prompted to upgrade your plan. Your existing QR codes will continue to work."
              },
              {
                q: "Do you offer refunds?",
                a: "Yes, we offer a 14-day money-back guarantee on all paid plans."
              },
              {
                q: "Is there a free trial?",
                a: "Our Free plan is permanent and includes core features. No credit card required."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of businesses using SmartQR.ai to boost their conversions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/signup"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105"
            >
              Start Free Account
            </Link>
            <Link
              href="/demo"
              className="border border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-all"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}