'use client';

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, isLoading } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      window.location.href = '/dashboard';
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <Image src="/logo.svg" alt="SmartQR" width={120} height={32} className="h-8 w-auto" />
                <div className="text-xs text-gray-500">Códigos QR Inteligentes</div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowDemo(true)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Demo
              </button>
              <Link 
                href="/login" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Login
              </Link>
              <Link 
                href="/signup" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-6">
            🚀 Launch your smart QR codes in minutes
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            QR Codes That
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-pulse">
              Learn & Adapt
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Create dynamic QR codes that get smarter with every scan. 
            <br />
            <strong className="text-blue-600">Personalize experiences automatically</strong> using AI and <strong className="text-green-600">boost conversion rates by up to 3x</strong>.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/signup" 
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105 flex items-center justify-center"
            >
              🎯 Create Your First Smart QR
            </Link>
            <button
              onClick={() => setShowDemo(true)}
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center"
            >
              ▶️ Watch 2-Min Demo
            </button>
          </div>

          {/* Social Proof */}
          <div className="text-center mb-16">
            <div className="flex justify-center items-center space-x-8 text-gray-500 text-sm mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Free to start</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span>Setup in 2 minutes</span>
              </div>
            </div>
            
            {/* Enhanced Social Proof */}
            <div className="bg-white rounded-2xl shadow-lg p-6 max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div className="border-r border-gray-200 last:border-r-0">
                  <div className="text-3xl font-bold text-blue-600 mb-1">10K+</div>
                  <div className="text-gray-600 text-sm">Smart QR codes created</div>
                </div>
                <div className="border-r border-gray-200 last:border-r-0">
                  <div className="text-3xl font-bold text-purple-600 mb-1">3x</div>
                  <div className="text-gray-600 text-sm">Average conversion boost</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-600 mb-1">98%</div>
                  <div className="text-gray-600 text-sm">Customer satisfaction</div>
                </div>
              </div>
              
              {/* Live Activity Feed */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>María from Madrid just created a smart QR code</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-2xl">🔄</span>
            </div>
            <h3 className="text-xl font-bold mb-4 text-gray-900">Dynamic & Smart</h3>
            <p className="text-gray-600 leading-relaxed">
              Change destinations without reprinting. Same QR code, infinite possibilities. 
              Update content instantly from your dashboard.
            </p>
          </div>
          
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-2xl">🧠</span>
            </div>
            <h3 className="text-xl font-bold mb-4 text-gray-900">AI Personalization</h3>
            <p className="text-gray-600 leading-relaxed">
              AI learns from each scan and adapts. Mobile users see mobile pages, 
              business hours show different content. It's magic.
            </p>
          </div>
          
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-2xl">📊</span>
            </div>
            <h3 className="text-xl font-bold mb-4 text-gray-900">Smart Analytics</h3>
            <p className="text-gray-600 leading-relaxed">
              Deep insights on user behavior with AI suggestions. 
              Know exactly what works and what doesn't.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Create Account', desc: 'Sign up in 30 seconds', icon: '👤' },
              { step: '2', title: 'Generate QR', desc: 'Add your URL and customize', icon: '🎨' },
              { step: '3', title: 'Enable AI', desc: 'Let AI optimize automatically', icon: '🧠' },
              { step: '4', title: 'Watch Growth', desc: 'See conversions increase', icon: '📈' },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">What Our Users Say</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold">JM</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Juan Martínez</div>
                  <div className="text-sm text-gray-500">Marketing Director</div>
                </div>
              </div>
              <p className="text-gray-600 mb-4">"SmartQR boosted our campaign conversions by 250%. The AI automatically optimizes for mobile users - it's incredible!"</p>
              <div className="flex text-yellow-400">
                ⭐⭐⭐⭐⭐
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-purple-600 font-bold">AC</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Ana Castillo</div>
                  <div className="text-sm text-gray-500">Restaurant Owner</div>
                </div>
              </div>
              <p className="text-gray-600 mb-4">"Our QR menu adapts to lunch vs dinner hours automatically. Sales increased 40% since using SmartQR!"</p>
              <div className="flex text-yellow-400">
                ⭐⭐⭐⭐⭐
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
          <div className="relative">
            <div className="inline-flex items-center px-4 py-2 bg-white/20 rounded-full text-white text-sm font-medium mb-6">
              🔥 Limited Time: Extra features for early adopters
            </div>
            <h2 className="text-3xl font-bold mb-4">Ready to 3x Your Conversion Rates?</h2>
            <p className="text-xl mb-8 opacity-90">Join 10,000+ smart marketers already using AI-powered QR codes.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/signup"
                className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105 inline-flex items-center justify-center"
              >
                🚀 Start Free - No Credit Card
              </Link>
              <button
                onClick={() => setShowDemo(true)}
                className="border-2 border-white/30 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/10 transition-all inline-flex items-center justify-center"
              >
                📹 Watch Demo First
              </button>
            </div>
            <div className="mt-6 text-sm opacity-75">
              ✓ Free forever plan available • ✓ Setup in 2 minutes • ✓ Cancel anytime
            </div>
          </div>
        </div>
      </main>

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">🎥 SmartQR Demo</h2>
              <button
                onClick={() => setShowDemo(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="bg-gray-100 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-xl font-semibold mb-2">Demo Video Coming Soon!</h3>
              <p className="text-gray-600 mb-6">
                For now, try our live demo by signing up for free. 
                It takes less than 2 minutes to create your first smart QR code.
              </p>
              <Link 
                href="/signup"
                onClick={() => setShowDemo(false)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Try Live Demo →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
