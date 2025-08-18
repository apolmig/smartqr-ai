import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiEngine } from '@/lib/ai-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get analytics data
    const analytics = await db.getAnalytics(id);
    
    // Generate AI insights
    const insights = aiEngine.generateInsights(analytics);
    
    // Generate optimization suggestions
    const suggestions = aiEngine.suggestOptimizations(analytics);

    return NextResponse.json({
      success: true,
      analytics: {
        ...analytics,
        insights,
        suggestions
      }
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}