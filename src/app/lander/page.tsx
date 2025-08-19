'use client';

import Link from 'next/link';

export default function LanderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-8">
        {/* Logo */}
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <span className="text-white font-bold text-2xl">S</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          SmartQR
        </h1>
        
        <p className="text-gray-600 mb-8">
          Oops! The QR code you scanned seems to be inactive or doesn't exist. 
          <br />
          <br />
          But while you're here, why not create your own smart QR codes?
        </p>
        
        {/* CTA Buttons */}
        <div className="space-y-4">
          <Link
            href="/signup"
            className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105"
          >
            🚀 Create Your Smart QR Code
          </Link>
          
          <Link
            href="/"
            className="block w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Learn More About SmartQR
          </Link>
        </div>
        
        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-sm text-gray-600">
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-blue-600">🔄</span>
            </div>
            <span>Dynamic</span>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-purple-600">🧠</span>
            </div>
            <span>AI-Powered</span>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-green-600">📊</span>
            </div>
            <span>Analytics</span>
          </div>
        </div>
      </div>
    </div>
  );
}