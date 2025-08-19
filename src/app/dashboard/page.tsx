'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRequireAuth } from '@/contexts/AuthContext';
import { QR_PRESET_STYLES, QRPresetStyle, qrGenerator } from '@/lib/qr';

interface QRCode {
  id: string;
  shortId: string;
  name: string;
  targetUrl: string;
  totalScans: number;
  scanCount: number;
  isActive: boolean;
  enableAI: boolean;
  createdAt: string;
  qrCodeDataUrl?: string;
  redirectUrl?: string;
}

export default function DashboardPage() {
  const { user, logout, canCreateQRCode, incrementQRCount, getPlanInfo } = useRequireAuth();
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newQR, setNewQR] = useState({ 
    name: '', 
    targetUrl: '', 
    enableAI: false,
    style: 'classic' as QRPresetStyle,
    customColor: '#3B82F6',
    size: 256
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const planInfo = getPlanInfo();

  // Helper function to get style preset
  const getStylePreset = (preset: QRPresetStyle) => {
    const presets = {
      classic: {
        dotType: 'square' as const,
        cornerSquareType: 'square' as const,
        cornerDotType: 'square' as const
      },
      rounded: { 
        dotType: 'rounded' as const, 
        cornerSquareType: 'extra-rounded' as const,
        cornerDotType: 'dot' as const
      },
      dots: { 
        dotType: 'dots' as const, 
        cornerSquareType: 'dot' as const,
        cornerDotType: 'dot' as const
      },
      classy: { 
        dotType: 'classy-rounded' as const, 
        cornerSquareType: 'extra-rounded' as const,
        cornerDotType: 'dot' as const
      },
      gradient_blue: { 
        dotType: 'rounded' as const, 
        cornerSquareType: 'extra-rounded' as const,
        cornerDotType: 'dot' as const,
        dotsColor: '#3B82F6',
        cornerSquareColor: '#1E40AF',
        cornerDotColor: '#1E40AF',
        backgroundColor: '#EFF6FF'
      },
      gradient_purple: { 
        dotType: 'classy-rounded' as const, 
        cornerSquareType: 'extra-rounded' as const,
        cornerDotType: 'dot' as const,
        dotsColor: '#8B5CF6',
        cornerSquareColor: '#6D28D9',
        cornerDotColor: '#6D28D9',
        backgroundColor: '#F3E8FF'
      },
      smartqr_brand: { 
        dotType: 'rounded' as const,
        cornerSquareType: 'extra-rounded' as const,
        cornerDotType: 'dot' as const,
        dotsColor: '#3B82F6',
        cornerSquareColor: '#8B5CF6',
        cornerDotColor: '#8B5CF6',
        backgroundColor: '#ffffff'
      }
    };
    return presets[preset] || presets.classic;
  };

  // Generate QR preview with client-side styling
  const generatePreview = async () => {
    if (!newQR.targetUrl || !newQR.name) {
      setPreviewDataUrl(null);
      return;
    }

    setIsGeneratingPreview(true);
    
    try {
      const previewUrl = newQR.targetUrl.startsWith('http') 
        ? newQR.targetUrl 
        : `https://${newQR.targetUrl}`;
      
      // Force client-side generation for advanced styling
      if (typeof window !== 'undefined' && newQR.style !== 'classic') {
        // Use advanced client-side styling
        const dataUrl = await generateStyledQRPreview(previewUrl);
        setPreviewDataUrl(dataUrl);
      } else {
        // Fallback to basic QR for classic style or when client-side not available
        const qrOptions = {
          size: Math.min(newQR.size, 200),
          color: {
            dark: newQR.customColor,
            light: '#FFFFFF'
          }
        };

        // Import the basic qrcode library
        const QRCode = (await import('qrcode')).default;
        
        const qrCodeDataUrl = await QRCode.toDataURL(previewUrl, {
          width: qrOptions.size,
          margin: 2,
          color: qrOptions.color,
          errorCorrectionLevel: 'M'
        });
        
        setPreviewDataUrl(qrCodeDataUrl);
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      setPreviewDataUrl(null);
    }
    
    setIsGeneratingPreview(false);
  };

  // Client-side styled QR generation for preview
  const generateStyledQRPreview = async (data: string): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Dynamic import to ensure it only runs client-side
        const QRCodeStyling = (await import('qr-code-styling')).default;
        
        const stylePreset = getStylePreset(newQR.style);
        
        const qrCode = new QRCodeStyling({
          width: Math.min(newQR.size, 200),
          height: Math.min(newQR.size, 200),
          margin: 10,
          data: data,
          
          qrOptions: {
            errorCorrectionLevel: 'M'
          },
          
          dotsOptions: {
            color: stylePreset.dotsColor || newQR.customColor,
            type: stylePreset.dotType || 'square'
          },
          
          cornersSquareOptions: {
            color: stylePreset.cornerSquareColor || newQR.customColor,
            type: stylePreset.cornerSquareType || 'square'
          },
          
          cornersDotOptions: {
            color: stylePreset.cornerDotColor || newQR.customColor,
            type: stylePreset.cornerDotType || 'square'
          },
          
          backgroundOptions: {
            color: stylePreset.backgroundColor || '#ffffff'
          }
        });

        // Create a temporary canvas for generation
        const canvas = document.createElement('canvas');
        qrCode.append(canvas);
        
        // Wait a bit for rendering then get the data URL
        setTimeout(() => {
          try {
            const dataUrl = canvas.toDataURL('image/png', 0.9);
            // Clean up
            canvas.remove();
            resolve(dataUrl);
          } catch (err) {
            console.error('Canvas to data URL failed:', err);
            reject(err);
          }
        }, 200);
        
      } catch (error) {
        console.error('Styled QR generation error:', error);
        reject(error);
      }
    });
  };

  // Debounced preview generation
  const debouncedPreview = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    previewTimeoutRef.current = setTimeout(generatePreview, 500);
  };

  // Generate preview when settings change
  useEffect(() => {
    if (showCreateForm && (newQR.targetUrl || newQR.name)) {
      debouncedPreview();
    }
    
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [newQR.targetUrl, newQR.name, newQR.style, newQR.customColor, newQR.size, showCreateForm]);

  useEffect(() => {
    // Add dependency on user to refetch when user changes
    fetchQRCodes();
  }, [user]);

  const fetchQRCodes = async () => {
    if (!user) {
      console.log('No user found, skipping QR fetch');
      setIsLoading(false);
      return;
    }
    
    try {
      // Use Netlify functions in production, local API in development
      const endpoint = process.env.NODE_ENV === 'production' 
        ? `/.netlify/functions/qr-generate?userId=${user.id}`
        : `/api/qr/generate?userId=${user.id}`;
      
      console.log('Fetching QR codes from:', endpoint);
      console.log('User ID:', user.id);
      
      const response = await fetch(endpoint);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        setQrCodes(data.qrCodes);
        console.log('QR codes loaded:', data.qrCodes.length);
      } else {
        console.error('API returned error:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch QR codes:', error);
      // Still set loading to false even if error
    } finally {
      setIsLoading(false);
    }
  };

  const createQRCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user can create more QR codes
    const { canCreate, reason } = canCreateQRCode();
    if (!canCreate) {
      alert(reason);
      return;
    }

    setIsCreating(true);

    try {
      // Use Netlify functions in production, local API in development
      const endpoint = process.env.NODE_ENV === 'production' 
        ? '/.netlify/functions/qr-generate'
        : '/api/qr/generate';
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newQR.name,
          targetUrl: newQR.targetUrl,
          enableAI: newQR.enableAI,
          userId: user?.id,
          qrOptions: {
            size: newQR.size,
            style: newQR.style !== 'classic' ? {
              ...getStylePreset(newQR.style),
              dotsColor: newQR.customColor
            } : undefined
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setQrCodes([data.qrCode, ...qrCodes]);
        setNewQR({ 
          name: '', 
          targetUrl: '', 
          enableAI: false,
          style: 'classic' as QRPresetStyle,
          customColor: '#3B82F6',
          size: 256
        });
        setShowCreateForm(false);
        setShowAdvanced(false);
        setPreviewDataUrl(null);
        
        // Update user QR count
        incrementQRCount();
      } else {
        alert(data.error || 'Failed to create QR code');
      }
    } catch (error) {
      console.error('Failed to create QR code:', error);
      alert('Failed to create QR code');
    } finally {
      setIsCreating(false);
    }
  };

  const downloadQR = (qrCode: QRCode) => {
    if (!qrCode.qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.download = `${qrCode.name.replace(/\s+/g, '_')}_QR.png`;
    link.href = qrCode.qrCodeDataUrl;
    link.click();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleAI = async (qrCode: QRCode) => {
    // Temporarily disable AI toggle in production until we create the Netlify function
    if (process.env.NODE_ENV === 'production') {
      alert('AI toggle feature coming soon in production!');
      return;
    }
    
    try {
      const response = await fetch(`/api/qr/${qrCode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableAI: !qrCode.enableAI })
      });

      const data = await response.json();
      if (data.success) {
        const updatedQRs = qrCodes.map(qr => 
          qr.id === qrCode.id ? { ...qr, enableAI: !qr.enableAI } : qr
        );
        setQrCodes(updatedQRs);
        
        alert(`AI ${qrCode.enableAI ? 'disabled' : 'enabled'} for ${qrCode.name}`);
      } else {
        alert('Failed to update AI setting');
      }
    } catch (err) {
      console.error('Failed to toggle AI:', err);
      alert('Failed to update AI setting');
    }
  };

  const seedTestData = async () => {
    // Temporarily disable seed function in production until we create the Netlify function
    if (process.env.NODE_ENV === 'production') {
      alert('Demo data feature coming soon in production!');
      return;
    }
    
    try {
      const response = await fetch('/api/seed', {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        alert('Demo data generated! Refreshing...');
        fetchQRCodes();
      } else {
        alert('Failed to generate demo data');
      }
    } catch (err) {
      console.error('Failed to seed data:', err);
      alert('Failed to generate demo data');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">SmartQR</span>
                <div className="text-xs text-gray-500">Dashboard</div>
              </div>
            </Link>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                + Create QR Code
              </button>
              
              {qrCodes.length === 0 && user?.email === 'demo@smartqr.ai' && (
                <button
                  onClick={seedTestData}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  🎯 Load Demo Data
                </button>
              )}
              
              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{user?.name || 'User'}</div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${planInfo.color}`}>
                      {planInfo.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {qrCodes.length}/{user?.plan === 'FREE' ? '3' : user?.plan === 'SMART' ? '25' : '100'} QRs
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total QR Codes</h3>
            <p className="text-3xl font-bold text-gray-900">{qrCodes.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Scans</h3>
            <p className="text-3xl font-bold text-gray-900">
              {qrCodes.reduce((sum, qr) => sum + (qr.scanCount || 0), 0)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Active QR Codes</h3>
            <p className="text-3xl font-bold text-gray-900">
              {qrCodes.filter(qr => qr.isActive).length}
            </p>
          </div>
        </div>

        {/* QR Codes List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your QR Codes</h2>
          </div>
          
          {qrCodes.length === 0 ? (
            <div className="text-center py-16">
              <div className="mb-8">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🎯</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Create Your First Smart QR?</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  SmartQR codes are dynamic and learn from every scan. 
                  Start with any URL and watch the AI optimize for better conversions.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105"
                >
                  🚀 Create Your First QR Code
                </button>
                
                {user?.email === 'demo@smartqr.ai' && (
                  <button
                    onClick={seedTestData}
                    className="border border-purple-300 text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
                  >
                    📊 Load Demo Data Instead
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white text-lg">🔄</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Dynamic URLs</h4>
                  <p className="text-sm text-gray-600">Change destinations anytime without reprinting your QR code.</p>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white text-lg">🧠</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">AI Learning</h4>
                  <p className="text-sm text-gray-600">AI adapts content based on device, time, and user behavior.</p>
                </div>
                
                <div className="bg-green-50 p-6 rounded-lg">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white text-lg">📊</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Smart Analytics</h4>
                  <p className="text-sm text-gray-600">Deep insights with actionable AI recommendations.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {qrCodes.map((qr) => (
                <div key={qr.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {qr.qrCodeDataUrl && (
                      <Image 
                        src={qr.qrCodeDataUrl} 
                        alt={`QR code for ${qr.name}`}
                        width={50}
                        height={50}
                        className="rounded"
                      />
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900">{qr.name}</h3>
                      <p className="text-sm text-gray-500 truncate max-w-xs">{qr.targetUrl}</p>
                      <p className="text-xs text-gray-400">
                        {qr.scanCount || 0} scans • Created {new Date(qr.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/dashboard/${qr.id}`}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      Analytics & AI
                    </Link>
                    <button
                      onClick={() => copyToClipboard(qr.redirectUrl || '')}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => downloadQR(qr)}
                      className="text-green-600 hover:text-green-800 text-sm"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => toggleAI(qr)}
                      className={`px-2 py-1 text-xs rounded-full ${
                        qr.enableAI 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {qr.enableAI ? '🧠 AI On' : '🧠 AI Off'}
                    </button>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      qr.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {qr.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create QR Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">🎨 Create New QR Code</h2>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setPreviewDataUrl(null);
                  if (previewTimeoutRef.current) {
                    clearTimeout(previewTimeoutRef.current);
                  }
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={createQRCode} className="space-y-4">
              <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
                {/* Left Column - Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      QR Code Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newQR.name}
                      onChange={(e) => setNewQR({...newQR, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
                      placeholder="e.g., Website Homepage"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target URL
                    </label>
                    <input
                      type="url"
                      required
                      value={newQR.targetUrl}
                      onChange={(e) => setNewQR({...newQR, targetUrl: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
                      placeholder="https://example.com"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="enableAI"
                      type="checkbox"
                      checked={newQR.enableAI}
                      onChange={(e) => setNewQR({...newQR, enableAI: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enableAI" className="ml-2 block text-sm text-gray-900">
                      🧠 Enable AI Smart Routing
                    </label>
                  </div>
                </div>

                {/* Right Column - Design Options */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🎨 QR Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries({
                        classic: 'Clásico',
                        rounded: 'Redondeado', 
                        dots: 'Puntos',
                        classy: 'Elegante',
                        gradient_blue: 'Azul',
                        smartqr_brand: 'SmartQR'
                      }).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setNewQR({...newQR, style: value as QRPresetStyle})}
                          className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                            newQR.style === value
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🎯 Size
                    </label>
                    <select
                      value={newQR.size}
                      onChange={(e) => setNewQR({...newQR, size: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      <option value={128}>Pequeño (128px)</option>
                      <option value={256}>Mediano (256px)</option>
                      <option value={512}>Grande (512px)</option>
                      <option value={1024}>Extra Grande (1024px)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🌈 Color Principal
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={newQR.customColor}
                        onChange={(e) => setNewQR({...newQR, customColor: e.target.value})}
                        className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newQR.customColor}
                        onChange={(e) => setNewQR({...newQR, customColor: e.target.value})}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      👁️ Vista Previa
                    </label>
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                      {isGeneratingPreview ? (
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-xs text-gray-500">Generando...</p>
                        </div>
                      ) : previewDataUrl ? (
                        <div className="text-center">
                          <img 
                            src={previewDataUrl} 
                            alt="QR Preview" 
                            className="mx-auto rounded-lg shadow-sm"
                            style={{ maxWidth: '150px', maxHeight: '150px' }}
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            {newQR.size}px • {newQR.style}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center text-gray-400">
                          <div className="w-16 h-16 mx-auto mb-2 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">📱</span>
                          </div>
                          <p className="text-xs">
                            Ingresa nombre y URL para ver preview
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {previewDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `${newQR.name.replace(/\s+/g, '_')}_preview.png`;
                          link.href = previewDataUrl;
                          link.click();
                        }}
                        className="w-full mt-2 px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        💾 Descargar Preview
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setShowAdvanced(false);
                    setPreviewDataUrl(null);
                    if (previewTimeoutRef.current) {
                      clearTimeout(previewTimeoutRef.current);
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  {isCreating ? 'Creando...' : '✨ Crear QR Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}