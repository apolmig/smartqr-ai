import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiEngine } from '@/lib/ai-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const rules = await db.getRoutingRules(id);
    
    return NextResponse.json({
      success: true,
      rules
    });
  } catch (error) {
    console.error('Failed to fetch routing rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch routing rules' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, condition, targetUrl, priority = 5 } = body;

    if (!name || !condition || !targetUrl) {
      return NextResponse.json(
        { error: 'Name, condition, and target URL are required' },
        { status: 400 }
      );
    }

    const rule = await db.createRoutingRule({
      id: crypto.randomUUID(),
      qrCodeId: id,
      name,
      condition,
      targetUrl,
      priority,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      rule
    });
  } catch (error) {
    console.error('Failed to create routing rule:', error);
    return NextResponse.json(
      { error: 'Failed to create routing rule' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { ruleId, ...updateData } = body;

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const updatedRule = await db.updateRoutingRule(ruleId, id, updateData);
    
    if (!updatedRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      rule: updatedRule
    });
  } catch (error) {
    console.error('Failed to update routing rule:', error);
    return NextResponse.json(
      { error: 'Failed to update routing rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const deleted = await db.deleteRoutingRule(ruleId, id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete routing rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete routing rule' },
      { status: 500 }
    );
  }
}