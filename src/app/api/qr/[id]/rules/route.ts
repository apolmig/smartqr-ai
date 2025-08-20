import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SmartRoutingRule } from '@/lib/ai-enhanced';
import { ApiResponseHelper } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get QR code with routing rules
    const qrCode = await prisma.qRCode.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        enableAI: true,
        qrOptions: true
      }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Extract routing rules from qrOptions JSON
    let routingRules: SmartRoutingRule[] = [];
    if (qrCode.qrOptions) {
      try {
        const options = JSON.parse(qrCode.qrOptions);
        routingRules = options.routingRules || [];
      } catch (error) {
        console.error('Failed to parse routing rules:', error);
      }
    }
    
    return ApiResponseHelper.success({
      qrCode: {
        id: qrCode.id,
        name: qrCode.name,
        enableAI: qrCode.enableAI
      },
      routingRules
    });
    
  } catch (error) {
    console.error('Failed to fetch routing rules:', error);
    return ApiResponseHelper.internalError('Failed to fetch routing rules');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { rule }: { rule: Omit<SmartRoutingRule, 'id'> } = await request.json();
    
    // Validate rule
    if (!rule.name || !rule.targetUrl) {
      return ApiResponseHelper.badRequest('Rule name and target URL are required');
    }

    // Get current QR code
    const qrCode = await prisma.qRCode.findUnique({
      where: { id },
      select: { qrOptions: true }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Parse existing options
    let options: any = {};
    if (qrCode.qrOptions) {
      try {
        options = JSON.parse(qrCode.qrOptions);
      } catch (error) {
        console.error('Failed to parse existing options:', error);
      }
    }

    // Add new rule with generated ID
    const newRule: SmartRoutingRule = {
      ...rule,
      id: generateRuleId(),
      priority: rule.priority || 1,
      isActive: rule.isActive !== undefined ? rule.isActive : true
    };

    // Update routing rules
    if (!options.routingRules) {
      options.routingRules = [];
    }
    options.routingRules.push(newRule);

    // Save updated options
    await prisma.qRCode.update({
      where: { id },
      data: {
        qrOptions: JSON.stringify(options),
        enableAI: true // Enable AI when rules are added
      }
    });
    
    return ApiResponseHelper.success({
      rule: newRule,
      message: 'Routing rule created successfully'
    });
    
  } catch (error) {
    console.error('Failed to create routing rule:', error);
    return ApiResponseHelper.internalError('Failed to create routing rule');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { ruleId, updates }: { ruleId: string; updates: Partial<SmartRoutingRule> } = await request.json();
    
    if (!ruleId) {
      return ApiResponseHelper.badRequest('Rule ID is required');
    }

    // Get current QR code
    const qrCode = await prisma.qRCode.findUnique({
      where: { id },
      select: { qrOptions: true }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Parse existing options
    let options: any = { routingRules: [] };
    if (qrCode.qrOptions) {
      try {
        options = JSON.parse(qrCode.qrOptions);
      } catch (error) {
        console.error('Failed to parse existing options:', error);
      }
    }

    // Find and update the rule
    const ruleIndex = options.routingRules?.findIndex((rule: SmartRoutingRule) => rule.id === ruleId);
    if (ruleIndex === -1 || ruleIndex === undefined) {
      return ApiResponseHelper.notFound('Routing rule not found');
    }

    // Update the rule
    options.routingRules[ruleIndex] = {
      ...options.routingRules[ruleIndex],
      ...updates
    };

    // Save updated options
    await prisma.qRCode.update({
      where: { id },
      data: {
        qrOptions: JSON.stringify(options)
      }
    });
    
    return ApiResponseHelper.success({
      rule: options.routingRules[ruleIndex],
      message: 'Routing rule updated successfully'
    });
    
  } catch (error) {
    console.error('Failed to update routing rule:', error);
    return ApiResponseHelper.internalError('Failed to update routing rule');
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
      return ApiResponseHelper.badRequest('Rule ID is required');
    }

    // Get current QR code
    const qrCode = await prisma.qRCode.findUnique({
      where: { id },
      select: { qrOptions: true }
    });

    if (!qrCode) {
      return ApiResponseHelper.notFound('QR code not found');
    }

    // Parse existing options
    let options: any = { routingRules: [] };
    if (qrCode.qrOptions) {
      try {
        options = JSON.parse(qrCode.qrOptions);
      } catch (error) {
        console.error('Failed to parse existing options:', error);
      }
    }

    // Remove the rule
    if (options.routingRules) {
      options.routingRules = options.routingRules.filter((rule: SmartRoutingRule) => rule.id !== ruleId);
    }

    // Save updated options
    await prisma.qRCode.update({
      where: { id },
      data: {
        qrOptions: JSON.stringify(options)
      }
    });
    
    return ApiResponseHelper.success({
      message: 'Routing rule deleted successfully'
    });
    
  } catch (error) {
    console.error('Failed to delete routing rule:', error);
    return ApiResponseHelper.internalError('Failed to delete routing rule');
  }
}

function generateRuleId(): string {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}