'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface QRAnalytics {
  totalScans: number;
  deviceBreakdown: Record<string, number>;
  timePatterns: Record<string, number>;
  recentScans: any[];
  insights: string[];
  suggestions: Array<{
    type: string;
    suggestion: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

interface RoutingRule {
  id: string;
  name: string;
  condition: string;
  targetUrl: string;
  priority: number;
  isActive: boolean;
}

export default function QRDetailPage() {
  const params = useParams();
  const qrId = params.id as string;
  
  const [analytics, setAnalytics] = useState<QRAnalytics | null>(null);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    condition: 'mobile',
    targetUrl: '',
    priority: 5
  });

  useEffect(() => {
    if (qrId) {
      fetchData();
    }
  }, [qrId]);

  const fetchData = async () => {
    try {
      const [analyticsRes, rulesRes] = await Promise.all([
        fetch(`/api/qr/${qrId}/analytics`),
        fetch(`/api/qr/${qrId}/rules`)
      ]);

      const analyticsData = await analyticsRes.json();
      const rulesData = await rulesRes.json();

      if (analyticsData.success) {
        setAnalytics(analyticsData.analytics);
      }
      if (rulesData.success) {
        setRules(rulesData.rules);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/qr/${qrId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });

      const data = await response.json();
      if (data.success) {
        setRules([...rules, data.rule]);
        setNewRule({ name: '', condition: 'mobile', targetUrl: '', priority: 5 });
        setShowAddRule(false);
      }
    } catch (error) {
      console.error('Failed to add rule:', error);
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/qr/${qrId}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, isActive: !isActive })
      });

      const data = await response.json();
      if (data.success) {
        setRules(rules.map(rule => 
          rule.id === ruleId ? { ...rule, isActive: !isActive } : rule
        ));
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
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
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Back to Dashboard
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <span className="text-xl font-bold text-gray-900">SmartQR.ai</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">QR Code Analytics & AI</h1>
          <p className="text-gray-600">Detailed insights and smart routing configuration</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Analytics Section */}
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Scans</h3>
                <p className="text-3xl font-bold text-gray-900">{analytics?.totalScans || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Active Rules</h3>
                <p className="text-3xl font-bold text-gray-900">{rules.filter(r => r.isActive).length}</p>
              </div>
            </div>

            {/* Device Breakdown */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Device Breakdown</h3>
              {analytics?.deviceBreakdown && Object.keys(analytics.deviceBreakdown).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(analytics.deviceBreakdown).map(([device, count]) => (
                    <div key={device} className="flex justify-between items-center">
                      <span className="capitalize text-gray-600">{device}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(count / (analytics.totalScans || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No scan data yet</p>
              )}
            </div>

            {/* AI Insights */}
            {analytics?.insights && analytics.insights.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🧠 AI Insights</h3>
                <div className="space-y-3">
                  {analytics.insights.map((insight, index) => (
                    <div key={index} className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-700">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optimization Suggestions */}
            {analytics?.suggestions && analytics.suggestions.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">💡 Optimization Suggestions</h3>
                <div className="space-y-3">
                  {analytics.suggestions.map((suggestion, index) => (
                    <div key={index} className="border border-gray-200 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{suggestion.type}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getImpactColor(suggestion.impact)}`}>
                          {suggestion.impact} impact
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{suggestion.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Smart Routing Section */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Smart Routing Rules</h3>
                <button
                  onClick={() => setShowAddRule(true)}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  Add Rule
                </button>
              </div>
              
              {rules.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No routing rules yet</p>
                  <p className="text-sm text-gray-400">Create rules to automatically direct users to different URLs based on their device, time, or other conditions.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div key={rule.id} className="border border-gray-200 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{rule.name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            Priority: {rule.priority}
                          </span>
                          <button
                            onClick={() => toggleRule(rule.id, rule.isActive)}
                            className={`px-2 py-1 text-xs rounded ${
                              rule.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Condition:</span> {rule.condition}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        <span className="font-medium">Target:</span> {rule.targetUrl}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Scans */}
            {analytics?.recentScans && analytics.recentScans.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Scans</h3>
                <div className="space-y-2">
                  {analytics.recentScans.map((scan, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium">{scan.device || 'Unknown'}</span>
                        <span className="text-gray-500 ml-2">{scan.os}</span>
                      </div>
                      <span className="text-gray-500">
                        {new Date(scan.scannedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Rule Modal */}
        {showAddRule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">Add Smart Routing Rule</h2>
              <form onSubmit={addRule} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newRule.name}
                    onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Mobile Users"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition
                  </label>
                  <select
                    value={newRule.condition}
                    onChange={(e) => setNewRule({...newRule, condition: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="mobile">Mobile Device</option>
                    <option value="desktop">Desktop</option>
                    <option value="tablet">Tablet</option>
                    <option value="business_hours">Business Hours (9AM-5PM)</option>
                    <option value="after_hours">After Hours</option>
                    <option value="weekend">Weekend</option>
                    <option value="weekday">Weekday</option>
                    <option value="ios">iOS Device</option>
                    <option value="android">Android Device</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target URL
                  </label>
                  <input
                    type="url"
                    required
                    value={newRule.targetUrl}
                    onChange={(e) => setNewRule({...newRule, targetUrl: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/mobile"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (1-10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({...newRule, priority: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddRule(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}